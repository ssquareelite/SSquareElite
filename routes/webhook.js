const Stripe = require('stripe');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// This is a plain handler (not a router) because it must be mounted with
// express.raw() directly at app.post('/api/checkout/webhook', ...), BEFORE
// express.json() would otherwise consume/parse the body Stripe needs raw
// to verify the signature.
async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const order = await Order.findByStripeSessionId(session.id);
        if (order && order.status !== 'paid') {
          await Order.updateStatus(session.id, 'paid', session.payment_intent);
          // Clear the buyer's cart now that payment succeeded
          await Cart.clearCart(order.user);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        await Order.updateStatus(session.id, 'cancelled');
        break;
      }
      default:
        // Other event types are ignored for this app
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = stripeWebhookHandler;
