const express = require('express');
const User = require('../models/User');

const router = express.Router();

// One-time admin promotion, for hosts with no shell/terminal access.
// Only works when ADMIN_BOOTSTRAP_TOKEN is set as a secret AND matches the
// token sent — leave that secret unset (or delete it) once you're done.
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const configuredToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!configuredToken) {
      return res.status(404).json({ error: 'Not available' });
    }
    const { token, email } = req.body;
    if (token !== configuredToken) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }
    const existing = await User.findByEmail(email);
    if (!existing) {
      return res.status(404).json({ error: `No user found with email ${email}. Sign up on the site first.` });
    }
    await User.updateRole(email, 'admin');
    res.json({ ok: true, message: `${email} is now an admin.` });
  } catch (err) {
    res.status(500).json({ error: 'Bootstrap failed', details: err.message });
  }
});

module.exports = router;
