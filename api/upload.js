'use strict';
// Admin file vault (token required):
//   POST { action:'upload', token, name, dataB64 } -> { ok, file }
//   POST { action:'list', token }                  -> { ok, files }
//   POST { action:'delete', token, id }            -> { ok }
// Download: GET /api/file/:id?token=... (handled in server.js)

const { saveFile, listFiles, deleteFile, ALLOWED_EXT } = require('../lib/db');
const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};

  if (!requireAdmin(body.token)) return res.status(401).json({ error: 'Unauthorized' });

  if (body.action === 'upload') {
    try {
      const file = saveFile({ name: body.name, dataB64: body.dataB64 });
      return res.json({ ok: true, file });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (body.action === 'list') {
    return res.json({ ok: true, files: listFiles(), allowed: ALLOWED_EXT });
  }

  if (body.action === 'delete') {
    if (!deleteFile(String(body.id || ''))) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
