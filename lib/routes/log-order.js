'use strict';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  console.log('[log-order]', req.body);
  return res.json({ ok: true });
};
