const express = require('express');
const Stripe = require('stripe');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/checkout/create-session
// Builds a Stripe Checkout Session from the user's current cart and
// creates a matching "pending" Order we reconcile via webhook.
router.post('/create-session', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const items = await Cart.getItemsForUser(req.user.id);
    if (items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty' });
    }

    const line_items = items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: i.product.currency || 'usd',
        unit_amount: Math.round(i.product.price * 100), // Stripe uses smallest currency unit
        product_data: {
          name: i.product.name,
          images: i.product.image?.startsWith('http') ? [i.product.image] : undefined
        }
      }
    }));

    const subtotal = +items
      .reduce((sum, i) => sum + i.product.price * i.quantity, 0)
      .toFixed(2);
    const shipping = subtotal >= 999 ? 0 : 99;
    const tax = +(subtotal * 0.18).toFixed(2);
    const total = +(subtotal + shipping + tax).toFixed(2);
    const currency = items[0].product.currency || 'usd';

    if (shipping > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(shipping * 100),
          product_data: { name: 'Shipping' }
        }
      });
    }
    if (tax > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(tax * 100),
          product_data: { name: 'Tax (18% GST)' }
        }
      });
    }

    const order = await Order.create({
      user: req.user.id,
      items: items.map((i) => ({
        product: i.product._id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      })),
      total,
      currency
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items,
      success_url: `${process.env.CLIENT_URL || 'https://ssquareelite.online'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'https://ssquareelite.online'}/cancel.html`,
      metadata: {
        orderId: order._id,
        userId: String(req.user.id)
      }
    });

    await Order.setStripeSessionId(order._id, session.id);

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Could not start checkout', details: err.message });
  }
});

// GET /api/checkout/order/:sessionId
// Used by success.html to confirm/display the order after redirect back from Stripe.
router.get('/order/:sessionId', requireAuth, async (req, res) => {
  try {
    const order = await Order.findByStripeSessionId(req.params.sessionId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order', details: err.message });
  }
});

module.exports = router;
