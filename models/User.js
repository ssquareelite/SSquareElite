const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');

function toUser(row) {
  if (!row) return null;
  return {
    _id: String(row.id),
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password, // only present when explicitly selected by the caller
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    toSafeObject() {
      return {
        id: String(row.id),
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at
      };
    },
    async comparePassword(candidate) {
      return bcrypt.compare(candidate, row.password);
    }
  };
}

async function findByEmail(email) {
  const db = getPool();
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase()]);
  return toUser(rows[0]);
}

async function findById(id) {
  const db = getPool();
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return toUser(rows[0]);
}

async function create({ name, email, password }) {
  const db = getPool();
  const hashed = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email.toLowerCase(), hashed]
  );
  return findById(result.insertId);
}

async function updateRole(email, role) {
  const db = getPool();
  await db.query('UPDATE users SET role = ? WHERE email = ?', [role, email.toLowerCase()]);
  return findByEmail(email);
}

module.exports = { findByEmail, findById, create, updateRole };
