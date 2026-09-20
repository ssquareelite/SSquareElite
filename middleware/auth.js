const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the JWT stored in the httpOnly cookie and attaches req.user.
// Responds 401 if missing/invalid.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    req.user = user;
    req.user._id = String(user.id); // keeps existing route code using req.user._id working unchanged
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Attaches req.user if a valid token is present, but doesn't block the request otherwise.
async function attachUserIfPresent(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return next();
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (user) req.user = user;
    next();
  } catch (err) {
    next();
  }
}

// Must be used AFTER requireAuth — checks the already-attached req.user has admin role.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, attachUserIfPresent, requireAdmin };
