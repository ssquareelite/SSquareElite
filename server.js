require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const checkoutRoutes = require('./routes/checkout');
const adminRoutes = require('./routes/admin');

const app = express();

// GoDaddy's Node.js Hosting has no shell/terminal access, so `npm run seed`
// can't be run by hand. Instead: connect + create tables, then seed
// automatically on startup only if the products table is empty, so this
// never overwrites real data. The server still starts even if the database
// isn't reachable yet, so /health and static pages keep working while the
// underlying issue (e.g. missing env vars) gets fixed and the app restarts.
async function startup() {
  try {
    await connectDB();
    const Product = require('./models/Product');
    const count = await Product.countAll();
    if (count === 0) {
      const seedProducts = require('./scripts/seed-data');
      await Product.insertMany(seedProducts.map((p) => ({ ...p, currency: 'inr' })));
      console.log(`Auto-seeded ${seedProducts.length} products (database was empty).`);
    }
  } catch (err) {
    console.error('Database startup failed:', err.message);
  }
}

startup();

// GoDaddy/cPanel runs the app behind a Passenger/Apache proxy. Without this,
// Express thinks the connection is plain HTTP and `secure: true` cookies are
// never sent, which silently breaks login on the live site.
app.set('trust proxy', 1);

const CLIENT_URL = process.env.CLIENT_URL || 'https://ssquareelite.online';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(cookieParser());

// Stripe requires the RAW request body to verify webhook signatures, so this
// route is registered with express.raw() BEFORE the global express.json()
// middleware below would otherwise parse it.
app.post(
  '/api/checkout/webhook',
  express.raw({ type: 'application/json' }),
  require('./routes/webhook')
);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', require('./routes/bootstrap'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ToyLand server running on port ${PORT}`));
