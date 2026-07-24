'use strict';
const { getAdminConfig, signToken } = require('../auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cfg      = getAdminConfig();
  const email    = (req.body.email    || '').toLowerCase().trim();
  const password = (req.body.password || '').trim();

  if (email !== cfg.email || password !== cfg.password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(cfg.secret);
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; SameSite=Lax; Max-Age=43200; Path=/${req.protocol === 'https' ? '; Secure' : ''}`);
  return res.json({ ok: true, token });
};
