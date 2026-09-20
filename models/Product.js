const { getPool } = require('../config/db');

// Shapes a MySQL row to look like the old Mongoose product document, so
// routes and the frontend (which expects _id, oldPrice, createdAt, etc.)
// don't need to change.
function toProduct(row) {
  if (!row) return null;
  return {
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
    stock: row.stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function find(filter = {}) {
  const db = getPool();
  const where = [];
  const params = [];
  if (filter.category) {
    where.push('category = ?');
    params.push(filter.category);
  }
  const sql = `SELECT * FROM products${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows.map(toProduct);
}

async function findOne(filter = {}) {
  const db = getPool();
  if (filter.slug) {
    const [rows] = await db.query('SELECT * FROM products WHERE slug = ? LIMIT 1', [filter.slug]);
    return toProduct(rows[0]);
  }
  return null;
}

async function findById(id) {
  const db = getPool();
  const [rows] = await db.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
  return toProduct(rows[0]);
}

async function create(data) {
  const db = getPool();
  const [result] = await db.query(
    `INSERT INTO products (name, slug, description, price, old_price, rating, currency, image, category, badge, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.slug,
      data.description || '',
      data.price,
      data.oldPrice ?? null,
      data.rating || '★★★★☆',
      data.currency || 'usd',
      data.image,
      data.category || 'general',
      data.badge || null,
      data.stock ?? 100
    ]
  );
  return findById(result.insertId);
}

async function updateById(id, data) {
  const db = getPool();
  const fields = [];
  const params = [];
  const map = {
    name: 'name',
    description: 'description',
    price: 'price',
    oldPrice: 'old_price',
    rating: 'rating',
    category: 'category',
    badge: 'badge',
    stock: 'stock',
    image: 'image'
  };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      params.push(data[key]);
    }
  }
  if (fields.length === 0) return findById(id);
  params.push(id);
  await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function deleteById(id) {
  const db = getPool();
  const product = await findById(id);
  if (!product) return null;
  await db.query('DELETE FROM products WHERE id = ?', [id]);
  return product;
}

async function insertMany(products) {
  const db = getPool();
  for (const p of products) {
    await create(p);
  }
}

async function countAll() {
  const db = getPool();
  const [rows] = await db.query('SELECT COUNT(*) AS count FROM products');
  return rows[0].count;
}

async function deleteAll() {
  const db = getPool();
  await db.query('DELETE FROM products');
}

module.exports = { find, findOne, findById, create, updateById, deleteById, insertMany, countAll, deleteAll };
