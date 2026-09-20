# ToyLand — Node.js + Express + MongoDB + Stripe E-commerce

A full e-commerce build on top of your ToyLand store design: user accounts (signup/login),
a MongoDB-backed product catalog and cart, and real payments via **Stripe Checkout**.

## What's included

- **Auth**: signup/login/logout with bcrypt-hashed passwords and JWT stored in an httpOnly cookie
- **Database**: MongoDB via Mongoose — `User`, `Product`, `Order` models
- **Cart**: stored server-side per logged-in user (not localStorage)
- **Payments**: Stripe Checkout (hosted payment page) + webhook that marks orders paid
- **Frontend**: your original ToyLand design, now driven by the API instead of hardcoded JS arrays

## Project structure

```
toyland-ecommerce/
├── server.js              # Express app entrypoint
├── config/db.js           # MongoDB connection
├── models/                # User, Product, Order (Mongoose schemas)
├── routes/                # auth, products, cart, checkout, webhook
├── middleware/auth.js     # JWT cookie verification
├── scripts/seed.js        # Populates the product catalog
└── public/                # Static frontend (index, login, signup, success, cancel)
```

## 1. Install dependencies

```bash
npm install
```

## 2. Set up MongoDB

Either run MongoDB locally, or create a free cluster at https://www.mongodb.com/cloud/atlas.

## 3. Set up Stripe

1. Create a Stripe account at https://dashboard.stripe.com (test mode is fine to start).
2. Get your **secret key** from https://dashboard.stripe.com/test/apikeys.
3. Install the Stripe CLI (https://stripe.com/docs/stripe-cli) to forward webhooks to your machine while developing:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/checkout/webhook
   ```
   This prints a `whsec_...` value — that's your webhook secret.

## 4. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
MONGODB_URI=your MongoDB connection string
JWT_SECRET=any long random string
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 5. Seed the product catalog

```bash
npm run seed
```

## 6. Run the app

```bash
npm start
```

Visit **http://localhost:3000**. In a second terminal, keep `stripe listen` running so
webhook events (payment confirmation) reach your server.

## Adding products as the store owner (admin)

You don't have to edit code to add toys — there's an admin page with an image upload.

1. Sign up for a normal account on the site (http://localhost:3000/signup.html)
2. Make that account an admin:
   ```bash
   npm run make-admin -- youremail@example.com
   ```
3. Log out and back in on the site — you'll now see a **🛠️ Admin** button in the nav
4. Go to `/admin.html` (or click the button) to add, edit, or delete toys — including uploading a product photo directly, or using an emoji if you don't have a photo

Uploaded images are stored in `public/img/uploads/`.

## How checkout works

1. User logs in, adds toys to their cart (stored in MongoDB against their account).
2. "Proceed to Checkout" calls `POST /api/checkout/create-session`, which builds a
   Stripe Checkout Session from the cart and creates a `pending` Order.
3. The browser is redirected to Stripe's hosted payment page (real card entry — Stripe
   handles all PCI-sensitive data, it never touches your server).
4. On success, Stripe redirects back to `/success.html`, and separately sends a
   `checkout.session.completed` webhook event to `/api/checkout/webhook`, which is what
   actually marks the Order `paid` and clears the user's cart. `success.html` polls
   briefly for that update.
5. If the user backs out of Stripe, they land on `/cancel.html` and their cart is untouched.

## Testing payments

In Stripe test mode, use card number `4242 4242 4242 4242`, any future expiry, any CVC,
and any postal code — no real charge occurs.

## Going to production

- Switch to live Stripe keys (`sk_live_...`) and register a **live** webhook endpoint in
  the Stripe Dashboard (the CLI's `stripe listen` is dev-only).
- Set `NODE_ENV=production` so auth cookies get `secure: true` (HTTPS only).
- Set `CLIENT_URL` to your real domain.
- Use a managed MongoDB (e.g. Atlas) with backups enabled.
