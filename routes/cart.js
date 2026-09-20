const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function getPopulatedCart(userId) {
  const rawItems = await Cart.getItemsForUser(userId);
  const items = rawItems.map((item) => ({
    product: item.product,
    quantity: item.quantity,
    lineTotal: +(item.product.price * item.quantity).toFixed(2)
  }));
  const subtotal = +items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
  const shipping = items.length === 0 ? 0 : subtotal >= 999 ? 0 : 99;
  const tax = +(subtotal * 0.18).toFixed(2);
  const total = +(subtotal + shipping + tax).toFixed(2);
  return { items, subtotal, shipping, tax, total };
}

// GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cart = await getPopulatedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load cart', details: err.message });
  }
});

// POST /api/cart  { productId, quantity }
router.post('/', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await Cart.addItem(req.user.id, productId, Number(quantity));
    const cart = await getPopulatedCart(req.user.id);
    res.status(201).json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to cart', details: err.message });
  }
});

// PATCH /api/cart/:productId  { quantity }
router.patch('/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    const updated = await Cart.updateItem(req.user.id, req.params.productId, Number(quantity));
    if (!updated) return res.status(404).json({ error: 'Item not in cart' });
    const cart = await getPopulatedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart', details: err.message });
  }
});

// DELETE /api/cart/:productId
router.delete('/:productId', async (req, res) => {
  try {
    await Cart.removeItem(req.user.id, req.params.productId);
    const cart = await getPopulatedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item', details: err.message });
  }
});

module.exports = router;
