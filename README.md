# SSQUARE ELITE — Website with Server

This turns your original static `index.html` into a real website backed by a
Node.js/Express server. The front end is unchanged visually — same design,
products, cart, and checkout UI — but the checkout flow now talks to a real
backend instead of only faking an order number in the browser.

## What the server does

- Serves the website (`public/index.html` and its assets) at `/`
- Serves an **admin panel** at `/admin.html` where you can log in and add,
  edit, or delete products/gift sets. Changes show up on the live site
  immediately — no code edits needed.
- Exposes a small JSON API:
  - `GET /api/products` — public, returns the current catalog (categories + products)
  - `POST /api/admin/login` / `POST /api/admin/logout` / `GET /api/admin/session` — admin auth
  - `POST /api/admin/products` — add a product (admin only)
  - `PUT /api/admin/products/:id` — edit a product (admin only)
  - `DELETE /api/admin/products/:id` — delete a product (admin only)
  - `POST /api/orders` — saves a new order (cart items, totals, payment method, customer details) to `data/orders.json` and returns an order ID
  - `GET /api/admin/orders` — lists all orders placed so far (admin only)
  - `GET /api/orders/:id` — look up one order by its ID
- The catalog shown on the homepage (categories, products, gift sets) is now
  loaded from the server (`data/products.json`) instead of being hardcoded in
  the HTML — so anything the admin adds/edits/deletes there is what visitors
  see.
- The checkout form on the site calls `POST /api/orders` when a customer
  clicks "Place Secure Order". If the server can't be reached for some reason,
  it quietly falls back to a locally-generated order number so the page never
  breaks.

## Admin login

Go to **http://localhost:3000/admin.html** (there's also a discreet "Admin
Login" link in the site footer).

Default credentials (⚠️ **change these before you deploy anywhere public**):

```
username: admin
password: admin123
```

Set your own via environment variables instead of editing the code:

```bash
ADMIN_USERNAME=youradmin ADMIN_PASSWORD=your-strong-password SESSION_SECRET=some-long-random-string npm start
```

Once logged in you can:
- Add a new product or gift set (name, category, price, old/strike-through
  price, image path, emoji fallback, badge, rating)
- Edit any existing product
- Delete a product

The very first time the server runs, it seeds the catalog from
`data/products.seed.json` (your original product list) into
`data/products.json`. After that, `data/products.json` is the live catalog —
back it up if you want to keep a copy of your data.

Note: this doesn't process real payments — it's the same "demo payment UI" as
before. Card/UPI/bank fields are just collected for display; wire up
Razorpay/Stripe/PayPal on the server if you want live payment capture.

## Folder structure

```
ssquare-server/
├── server.js          # Express server
├── package.json
├── data/
│   └── orders.json    # orders get appended here (auto-created)
└── public/
    ├── index.html      # your site
    └── assets/
        └── images/     # put your product/category images here
```

## Missing images

Your uploaded zip only contained the HTML file — the images it references
(e.g. `assets/images/panda lamp.png`, `assets/images/cute panda.png`, etc.)
weren't included. The site already has graceful fallbacks (emoji/icons show
up if an image is missing), so it will still work, but for the real images
just drop your image files into `public/assets/images/` using the exact
filenames referenced in `index.html`.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (v18+ recommended).

```bash
cd ssquare-server
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

To run on a different port:

```bash
PORT=8080 npm start
```

## Deploying it

Since this is a standard Express app, you can deploy it to any Node hosting
provider (Render, Railway, Fly.io, a VPS, etc.). Steps are generally:

1. Push this folder to a Git repo (or upload it directly)
2. Set the start command to `npm start`
3. Make sure the platform installs dependencies (`npm install`) automatically
4. Set the `PORT` environment variable if your host requires it (most inject
   this automatically)

For production use, you'd also want to swap the JSON-file order storage for
a real database (Postgres, MongoDB, etc.) — happy to help with that if you
want to take it further.
