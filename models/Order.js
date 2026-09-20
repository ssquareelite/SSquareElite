const { getPool } = require('../config/db');

async function attachItems(order) {
  if (!order) return null;
  const db = getPool();
  const [items] = await db.query(
    'SELECT product_id AS product, name, price, quantity FROM order_items WHERE order_id = ?',
    [order.id]
  );
  order.items = items.map((i) => ({
    product: i.product === null ? null : String(i.product),
    name: i.name,
    price: Number(i.price),
    quantity: i.quantity
  }));
  return order;
}

function toOrder(row) {
  if (!row) return null;
  return {
    _id: String(row.id),
    id: row.id,
    user: String(row.user_id),
    total: Number(row.total),
    currency: row.currency,
    status: row.status,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function create({ user, items, total, currency = 'usd', status = 'pending' }) {
  const db = getPool();
  const [result] = await db.query(
    'INSERT INTO orders (user_id, total, currency, status) VALUES (?, ?, ?, ?)',
    [user, total, currency, status]
  );
  const orderId = result.insertId;
  for (const item of items) {
    await db.query(
      'INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.product, item.name, item.price, item.quantity]
    );
  }
  const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return attachItems(toOrder(rows[0]));
}

async function setStripeSessionId(orderId, stripeSessionId) {
  const db = getPool();
  await db.query('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [stripeSessionId, orderId]);
}

async function findByStripeSessionId(stripeSessionId, userId = null) {
  const db = getPool();
  const params = [stripeSessionId];
  let sql = 'SELECT * FROM orders WHERE stripe_session_id = ?';
  if (userId !== null) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  const [rows] = await db.query(sql, params);
  return attachItems(toOrder(rows[0]));
}

async function updateStatus(stripeSessionId, status, paymentIntentId = null) {
  const db = getPool();
  const fields = ['status = ?'];
  const params = [status];
  if (paymentIntentId) {
    fields.push('stripe_payment_intent_id = ?');
    params.push(paymentIntentId);
  }
  params.push(stripeSessionId);
  await db.query(`UPDATE orders SET ${fields.join(', ')} WHERE stripe_session_id = ?`, params);
}

module.exports = { create, setStripeSessionId, findByStripeSessionId, updateStatus };
