const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Admin credentials -----------------------------------------------
// Change these before deploying! Best practice is to set them via
// environment variables instead of editing the code.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'ssquare-elite-change-this-secret';

// ---- Data files ---------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const SEED_FILE = path.join(DATA_DIR, 'products.seed.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(PRODUCTS_FILE)) {
    // First run: seed the catalog from products.seed.json so the site
    // has something to show. After this, products.json is the source
    // of truth and gets edited by the admin panel.
    const seed = fs.existsSync(SEED_FILE)
        ? fs.readFileSync(SEED_FILE, 'utf-8')
        : JSON.stringify({ categories: [], products: [], nextId: 1 });
    fs.writeFileSync(PRODUCTS_FILE, seed);
}

function readJSON(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        return fallback;
    }
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readCatalog() {
    return readJSON(PRODUCTS_FILE, { categories: [], products: [], nextId: 1 });
}
function writeCatalog(catalog) {
    writeJSON(PRODUCTS_FILE, catalog);
}
function readOrders() {
    return readJSON(ORDERS_FILE, []);
}
function writeOrders(orders) {
    writeJSON(ORDERS_FILE, orders);
}

// ---- Middleware -----------------------------------------------------
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 hour session
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(401).json({ error: 'Not authenticated. Please log in as admin.' });
}

// ---- Public: catalog --------------------------------------------------
// Anyone visiting the site can read the current catalog.
app.get('/api/products', (req, res) => {
    const catalog = readCatalog();
    res.json({ categories: catalog.categories, products: catalog.products });
});

// ---- Admin: auth --------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Invalid username or password.' });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
    res.json({ loggedIn: !!(req.session && req.session.isAdmin) });
});

// ---- Admin: manage products (protected) --------------------------------
app.post('/api/admin/products', requireAdmin, (req, res) => {
    const { name, sub, price, old, img, emoji, badge, rating, cat, type } = req.body || {};
    if (!name || price === undefined || price === null || !cat) {
        return res.status(400).json({ error: 'name, price and cat are required.' });
    }
    const catalog = readCatalog();
    const product = {
        id: catalog.nextId,
        name,
        sub: sub || '',
        price: Number(price),
        old: old ? Number(old) : null,
        img: img || '',
        emoji: emoji || '🎁',
        badge: badge || 'new',
        rating: rating ? Number(rating) : 5,
        cat,
        type: type === 'gift' ? 'gift' : 'product'
    };
    catalog.products.push(product);
    catalog.nextId += 1;
    writeCatalog(catalog);
    res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const catalog = readCatalog();
    const idx = catalog.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

    const { name, sub, price, old, img, emoji, badge, rating, cat, type } = req.body || {};
    const existing = catalog.products[idx];
    catalog.products[idx] = {
        ...existing,
        name: name ?? existing.name,
        sub: sub ?? existing.sub,
        price: price !== undefined ? Number(price) : existing.price,
        old: old === '' || old === null || old === undefined ? existing.old : Number(old),
        img: img ?? existing.img,
        emoji: emoji ?? existing.emoji,
        badge: badge ?? existing.badge,
        rating: rating !== undefined ? Number(rating) : existing.rating,
        cat: cat ?? existing.cat,
        type: type === 'gift' || type === 'product' ? type : existing.type
    };
    writeCatalog(catalog);
    res.json(catalog.products[idx]);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const catalog = readCatalog();
    const before = catalog.products.length;
    catalog.products = catalog.products.filter(p => p.id !== id);
    if (catalog.products.length === before) {
        return res.status(404).json({ error: 'Product not found.' });
    }
    writeCatalog(catalog);
    res.json({ ok: true });
});

// Admin can also add new categories
app.post('/api/admin/categories', requireAdmin, (req, res) => {
    const { name, img, sub } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required.' });
    const catalog = readCatalog();
    if (catalog.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: 'Category already exists.' });
    }
    catalog.categories.push({ name, img: img || '', sub: sub || '' });
    writeCatalog(catalog);
    res.status(201).json(catalog.categories);
});

// ---- Orders ---------------------------------------------------------
app.post('/api/orders', (req, res) => {
    const { items, subtotal, shipping, total, paymentMethod, customer } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty.' });
    }
    if (!customer || !customer.name || !customer.phone || !customer.address || !customer.city || !customer.pincode) {
        return res.status(400).json({ error: 'Missing delivery details.' });
    }

    const orders = readOrders();
    const order = {
        id: 'SE-' + Math.floor(100000 + Math.random() * 900000),
        createdAt: new Date().toISOString(),
        status: 'placed',
        items,
        subtotal,
        shipping,
        total,
        paymentMethod,
        customer
    };
    orders.push(order);
    writeOrders(orders);

    res.status(201).json(order);
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
    res.json(readOrders());
});

app.get('/api/orders/:id', (req, res) => {
    const order = readOrders().find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
});

app.listen(PORT, () => {
    console.log(`SSQUARE ELITE server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    console.log(`(default login is ${ADMIN_USERNAME} / ${ADMIN_PASSWORD} — change via env vars!)`);
});
