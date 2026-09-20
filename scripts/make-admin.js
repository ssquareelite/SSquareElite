require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/make-admin.js someone@example.com');
  process.exit(1);
}

async function run() {
  await connectDB();
  const existing = await User.findByEmail(email);
  if (!existing) {
    console.error(`No user found with email ${email}. Sign up on the site first, then run this again.`);
    process.exit(1);
  }
  await User.updateRole(email, 'admin');
  console.log(`${email} is now an admin. Log out and back in on the site to see the Admin link.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
