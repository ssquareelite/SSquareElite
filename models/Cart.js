const { getPool } = require('../config/db');

// Returns cart rows already "populated" with their product, matching the
// shape routes/cart.js and routes/checkout.js expect from the old
// User.findById(id).populate('cart.product') call.
async function getItemsForUser(userId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT c.quantity, p.*
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ?`,
    [userId]
  );
  return rows.map((row) => ({
    quantity: row.quantity,
    product: {
      _id: String(row.id),
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      price: Number(row.price),
      oldPrice: row.old_price === null ? null : Number(row.old_price),
      rating: row.rating,
      currency: row.currency,
      image: row.image,
      category: row.category,
      badge: row.badge,
      stock: row.stock
    }
  }));
}

async function addItem(userId, productId, quantity) {
  const db = getPool();
  await db.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [userId, productId, quantity]
  );
}

async function updateItem(userId, productId, quantity) {
  const db = getPool();
  const [result] = await db.query(
    'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
    [quantity, userId, productId]
  );
  return result.affectedRows > 0;
}

async function removeItem(userId, productId) {
  const db = getPool();
  await db.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, productId]);
}

async function clearCart(userId) {
  const db = getPool();
  await db.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
}

module.exports = { getItemsForUser, addItem, updateItem, removeItem, clearCart };
