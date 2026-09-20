# Deploying ToyLand on GoDaddy Node.js Hosting (MySQL version)

This version of the app has been rewritten from MongoDB to **MySQL**, because
GoDaddy's Node.js Hosting only allows outbound network connections on ports
80/443 plus its own managed MySQL — MongoDB Atlas (port 27017) is blocked at
the network level, no matter what's in the connection string or IP whitelist.

## What changed

- `config/db.js` — now uses `mysql2` and creates all tables automatically on
  first startup (`CREATE TABLE IF NOT EXISTS`), since this hosting has no
  shell to run migrations by hand.
- `models/User.js`, `models/Product.js`, `models/Order.js`, `models/Cart.js`
  (new) — rewritten as plain SQL query functions. They return objects shaped
  like the old Mongoose documents (`_id`, `oldPrice`, `createdAt`, etc.) so
  `public/*.html` and `public/js/app.js` did not need any changes.
- `server.js` — connects to MySQL, creates tables, and seeds 12 starter
  products automatically **only if the products table is empty** — safe to
  redeploy repeatedly without wiping real data.
- `scripts/seed.js`, `scripts/make-admin.js` — updated for the new models.

## Environment variables

GoDaddy provisions a managed MySQL database per app and injects these
automatically — **you do not set them yourself**:

```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
```

You still need to add these yourself in **Settings → Secrets**:

| Key | Value |
|---|---|
| `CLIENT_URL` | `https://ssquareelite.online` |
| `JWT_SECRET` | any long random string |
| `JWT_EXPIRES_IN` | `7d` |
| `STRIPE_SECRET_KEY` | your Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | your Stripe webhook signing secret |

(`NODE_ENV` is reserved by the platform — don't set it yourself.)

## Deploy steps

1. Upload this zip via **Update Preview** on your app's Overview page (the
   file structure is flat — `package.json` sits at the root of the zip, which
   this platform requires).
2. Add the Secrets above.
3. Restart the app.
4. Check **Logs** — you should see:
   ```
   MySQL connected and schema ready: <host>/<database>
   Auto-seeded 12 products (database was empty).
   ToyLand server running on port ...
   ```
5. Open the preview URL and confirm products load.
6. Once it's on the preview and works, use **Publish to Live**, and connect
   `ssquareelite.online` under **Settings → Domains**.

## Making yourself an admin

There's no shell/terminal on this platform, so `npm run make-admin` can't be
run directly here. Options:
- Run it locally against the same database (temporarily add the GoDaddy
  MySQL host/credentials to a local `.env`, if the DB allows external
  connections), or
- Ask me to add a one-time, secret-protected `/api/admin/bootstrap` endpoint
  that promotes a given email to admin, which you'd call once and then remove.

## Stripe webhook

Same as before — in Stripe Dashboard, add a webhook endpoint pointing to
`https://ssquareelite.online/api/checkout/webhook`, event
`checkout.session.completed`, and paste its signing secret into
`STRIPE_WEBHOOK_SECRET`.
