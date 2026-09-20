const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const products = await Product.find(filter);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load products', details: err.message });
  }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load product', details: err.message });
  }
});

module.exports = router;
