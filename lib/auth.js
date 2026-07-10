'use strict';
// Shared admin auth — HMAC-signed stateless tokens (12h TTL).

const crypto = require('crypto');

function getAdminConfig() {
  return {
    email: (process.env.ADMIN_EMAIL || 'admin@admexo.com').toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || 'AdmExo@Admin2026!',
    secret: process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ai-lead-engine-admin-secret',
  };
}

function signToken(secret) {
  const payload = JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000 });
  const b64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [b64, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const { exp } = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return Date.now() < exp;
  } catch {
    return false;
  }
}

function requireAdmin(token) {
  return verifyToken(token, getAdminConfig().secret);
}

module.exports = { getAdminConfig, signToken, verifyToken, requireAdmin };
