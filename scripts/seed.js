require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');
const products = require('./seed-data');

async function seed() {
  await connectDB();
  await Product.deleteAll();
  await Product.insertMany(products.map((p) => ({ ...p, currency: 'inr' })));
  console.log(`Seeded ${products.length} products.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
