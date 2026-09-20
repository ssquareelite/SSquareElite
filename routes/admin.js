const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require: logged in AND role === 'admin'
router.use(requireAuth, requireAdmin);

// --- image upload setup ---------------------------------------------------
const uploadDir = path.join(__dirname, '..', 'public', 'img', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only jpg, jpeg, png, webp, or gif images are allowed'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// --- routes ----------------------------------------------------------------

// GET /api/admin/products — list everything, including out-of-stock, for the admin table
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load products', details: err.message });
  }
});

// POST /api/admin/products — create a new toy. Accepts multipart/form-data:
// fields: name, description, price, oldPrice, rating, category, badge, stock
// file:   image (optional — if omitted, `imageEmoji` field is used instead as a fallback)
router.post('/products', upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, oldPrice, rating, category, badge, stock, imageEmoji } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    if (!req.file && !imageEmoji) {
      return res.status(400).json({ error: 'Provide either an image file or an emoji fallback' });
    }

    const image = req.file ? `img/uploads/${req.file.filename}` : imageEmoji;

    let slug = slugify(name);
    // avoid slug collisions
    const existing = await Product.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const product = await Product.create({
      name,
      slug,
      description: description || '',
      price: Number(price),
      oldPrice: oldPrice ? Number(oldPrice) : null,
      rating: rating || '★★★★☆',
      image,
      category: category || 'toys',
      badge: badge || null,
      stock: stock !== undefined ? Number(stock) : 100,
      currency: 'inr'
    });

    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
});

// PATCH /api/admin/products/:id — edit an existing toy (same fields, all optional; new image replaces old)
router.patch('/products/:id', upload.single('image'), async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name, description, price, oldPrice, rating, category, badge, stock, imageEmoji } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = Number(price);
    if (oldPrice !== undefined) updates.oldPrice = oldPrice ? Number(oldPrice) : null;
    if (rating) updates.rating = rating;
    if (category) updates.category = category;
    if (badge !== undefined) updates.badge = badge || null;
    if (stock !== undefined) updates.stock = Number(stock);

    if (req.file) {
      // clean up the old uploaded file if we're replacing it
      if (existing.image?.startsWith('img/uploads/')) {
        const oldPath = path.join(__dirname, '..', 'public', existing.image);
        fs.unlink(oldPath, () => {});
      }
      updates.image = `img/uploads/${req.file.filename}`;
    } else if (imageEmoji) {
      updates.image = imageEmoji;
    }

    const product = await Product.updateById(req.params.id, updates);
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.deleteById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.image?.startsWith('img/uploads/')) {
      const filePath = path.join(__dirname, '..', 'public', product.image);
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
});

module.exports = router;
