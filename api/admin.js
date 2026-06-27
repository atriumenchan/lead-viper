'use strict';
// Admin dashboard API for AI Lead Engine.
// Single endpoint, action-based:
//   POST { action:'login', email, password }            -> { ok, token }
//   POST { action:'data',  token }                       -> { ok, stats, orders, leads }
//   POST { action:'resend', token, leadId }              -> { ok } (resend welcome email)
//
// Auth: credentials are read from env vars with safe fallbacks.
//   ADMIN_EMAIL    (default: admin@admexo.com)
//   ADMIN_PASSWORD (default: AdmExo@Admin2026!)
//   ADMIN_SECRET   (default: derived from SUPABASE_SERVICE_ROLE_KEY) -> used to sign tokens

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { buildWelcomeEmail, sendEmail } = require('./_email');

const TIER_LABELS = { basic: 'Basic', silver: 'Silver', gold: 'Gold' };

function fmtPhone(countryCode, mobile) {
  if (!mobile) return '—';
  const m = String(mobile).trim();
  if (m.startsWith('+')) return m; // already full international number
  return `${countryCode || ''} ${m}`.trim();
}

function getAdminConfig() {
  return {
    email: (process.env.ADMIN_EMAIL || 'admin@admexo.com').toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || 'AdmExo@Admin2026!',
    secret: process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ai-lead-engine-admin-secret',
  };
}

// Stateless signed token: base64(payload).hmac  — valid for 12h.
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
  if (sig !== expected) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return Date.now() < exp;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cfg = getAdminConfig();
  const body = req.body || {};
  const action = body.action;

  // ── Login ────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const email = (body.email || '').toLowerCase().trim();
    const password = (body.password || '').trim();
    if (email !== cfg.email || password !== cfg.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ ok: true, token: signToken(cfg.secret) });
  }

  // All other actions require a valid token.
  if (!verifyToken(body.token, cfg.secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Resend welcome email ───────────────────────────────────────────────────
  if (action === 'resend') {
    const leadId = body.leadId;
    if (!leadId) return res.status(400).json({ error: 'leadId required' });

    const { data: lead } = await supabase.from('leads')
      .select('id, first_name, email, access_password')
      .eq('id', leadId).single();
    if (!lead || !lead.email) return res.status(404).json({ error: 'Lead not found' });

    let password = lead.access_password;
    if (!password) {
      password = crypto.randomBytes(4).toString('hex').toUpperCase();
      await supabase.from('leads').update({ access_password: password }).eq('id', leadId);
    }

    let tierLabel, bumps = [];
    const { data: order } = await supabase.from('orders')
      .select('tier, bump_funnel_copy, bump_ai_prompts')
      .eq('lead_id', leadId).eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(1).single();
    if (order) {
      tierLabel = TIER_LABELS[order.tier] || order.tier;
      if (order.bump_funnel_copy) bumps.push('AI Funnel Copy Creation Agent');
      if (order.bump_ai_prompts) bumps.push('AI Prompts That Build Your Offer');
    }

    const { subject, html, text } = buildWelcomeEmail({
      firstName: lead.first_name || 'there',
      email: lead.email, password, tierLabel, bumps,
    });
    try {
      const result = await sendEmail({ to: lead.email, subject, html, text });
      return res.json({ ok: true, sentTo: lead.email, messageId: result.MessageId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Data (stats + orders + leads) ──────────────────────────────────────────
  if (action === 'data') {
    const [{ data: leads }, { data: orders }] = await Promise.all([
      supabase.from('leads')
        .select('id, first_name, last_name, email, mobile, country_code, profession, converted, access_password, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('orders')
        .select('id, lead_id, tier, amount_cents, bump_funnel_copy, bump_ai_prompts, status, stripe_session_id, created_at, updated_at')
        .order('created_at', { ascending: false }),
    ]);

    const leadsArr = leads || [];
    const ordersArr = orders || [];
    const leadById = Object.fromEntries(leadsArr.map(l => [l.id, l]));

    // Enrich orders with customer info.
    const enrichedOrders = ordersArr.map(o => {
      const l = leadById[o.lead_id] || {};
      return {
        id: o.id,
        leadId: o.lead_id,
        name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.first_name || '—',
        email: l.email || '—',
        phone: fmtPhone(l.country_code, l.mobile),
        tier: o.tier,
        amount: o.amount_cents / 100,
        bumps: [o.bump_funnel_copy && 'Funnel Copy', o.bump_ai_prompts && 'AI Prompts'].filter(Boolean),
        status: o.status,
        password: l.access_password || null,
        session: o.stripe_session_id,
        createdAt: o.created_at,
      };
    });

    const completed = enrichedOrders.filter(o => o.status === 'completed');
    const revenue = completed.reduce((sum, o) => sum + o.amount, 0);
    const paidLeads = leadsArr.filter(l => l.converted).length;

    const stats = {
      totalLeads: leadsArr.length,
      paidLeads,
      conversionRate: leadsArr.length ? Math.round((paidLeads / leadsArr.length) * 1000) / 10 : 0,
      totalOrders: ordersArr.length,
      completedOrders: completed.length,
      pendingOrders: enrichedOrders.filter(o => o.status === 'pending').length,
      failedOrders: enrichedOrders.filter(o => o.status === 'failed' || o.status === 'refunded').length,
      revenue,
      avgOrderValue: completed.length ? Math.round((revenue / completed.length) * 100) / 100 : 0,
    };

    const enrichedLeads = leadsArr.map(l => ({
      id: l.id,
      name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.first_name || '—',
      email: l.email,
      phone: fmtPhone(l.country_code, l.mobile),
      profession: l.profession || '—',
      converted: l.converted,
      password: l.access_password || null,
      createdAt: l.created_at,
    }));

    return res.json({ ok: true, stats, orders: enrichedOrders, leads: enrichedLeads });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
