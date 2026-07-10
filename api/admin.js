'use strict';
// Control Center API — action-based, mirrors ai-lead-backend/api/admin.js contract:
//   POST { action:'login', email, password }  -> { ok, token }
//   POST { action:'data',  token }            -> { ok, mode, stats, series, orders, leads, events }
//
// Env:
//   ADMIN_EMAIL    (default: admin@admexo.com)
//   ADMIN_PASSWORD (default: AdmExo@Admin2026!)
//   ADMIN_SECRET   (token signing secret)

const { fetchAll } = require('../lib/store');
const { getAdminConfig, signToken, verifyToken } = require('../lib/auth');
const { getSettings, setSettings, listRoadmaps } = require('../lib/db');

const TIER_LABELS = { basic: 'Basic', silver: 'Silver', gold: 'Gold' };
const DAY = 86400000;

function fmtPhone(countryCode, mobile) {
  if (!mobile) return '—';
  const m = String(mobile).trim();
  if (m.startsWith('+')) return m;
  return `${countryCode || ''} ${m}`.trim();
}

// Per-day time series for the last `days` days.
function buildSeries(leads, orders, days = 30) {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const start = today.getTime() - i * DAY;
    const end = start + DAY;
    const dayLeads = leads.filter(l => { const t = +new Date(l.created_at); return t >= start && t < end; });
    const dayOrders = orders.filter(o => { const t = +new Date(o.created_at); return t >= start && t < end; });
    const completed = dayOrders.filter(o => o.status === 'completed');
    out.push({
      date: new Date(start).toISOString().slice(0, 10),
      leads: dayLeads.length,
      orders: completed.length,
      revenue: Math.round(completed.reduce((s, o) => s + o.amount_cents, 0)) / 100,
    });
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cfg = getAdminConfig();
  const body = req.body || {};
  const action = body.action;

  if (action === 'login') {
    const email = (body.email || '').toLowerCase().trim();
    const password = (body.password || '').trim();
    if (email !== cfg.email || password !== cfg.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ ok: true, token: signToken(cfg.secret) });
  }

  if (!verifyToken(body.token, cfg.secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (action === 'settings') {
    return res.json({ ok: true, settings: getSettings() });
  }

  if (action === 'set-settings') {
    const patch = {};
    if (typeof body.demoMode === 'boolean') patch.demoMode = body.demoMode;
    if (Number.isInteger(body.autoRefreshSec) && body.autoRefreshSec >= 5 && body.autoRefreshSec <= 600) {
      patch.autoRefreshSec = body.autoRefreshSec;
    }
    if (Number.isInteger(body.roadmapDelayMin) && body.roadmapDelayMin >= 0 && body.roadmapDelayMin <= 1440) {
      patch.roadmapDelayMin = body.roadmapDelayMin;
    }
    return res.json({ ok: true, settings: setSettings(patch) });
  }

  if (action === 'data') {
    let leads, orders, events, mode;
    try {
      ({ leads, orders, events, mode } = await fetchAll());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    const leadById = Object.fromEntries(leads.map(l => [l.id, l]));

    const enrichedOrders = orders.map(o => {
      const l = leadById[o.lead_id] || {};
      return {
        id: o.id,
        leadId: o.lead_id,
        name: [l.first_name, l.last_name].filter(Boolean).join(' ') || '—',
        email: l.email || '—',
        phone: fmtPhone(l.country_code, l.mobile),
        tier: o.tier,
        tierLabel: TIER_LABELS[o.tier] || o.tier,
        amount: o.amount_cents / 100,
        bumps: [o.bump_funnel_copy && 'Funnel Copy', o.bump_ai_prompts && 'AI Prompts'].filter(Boolean),
        status: o.status,
        session: o.stripe_session_id,
        createdAt: o.created_at,
      };
    });

    const completed = enrichedOrders.filter(o => o.status === 'completed');
    const revenue = Math.round(completed.reduce((s, o) => s + o.amount * 100, 0)) / 100;
    const paidLeads = leads.filter(l => l.converted).length;

    const now = Date.now();
    const last24 = enrichedOrders.filter(o => now - +new Date(o.createdAt) < DAY);
    const leads24 = leads.filter(l => now - +new Date(l.created_at) < DAY).length;
    const revenue24 = Math.round(last24.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount * 100, 0)) / 100;

    const tierCounts = { basic: 0, silver: 0, gold: 0 };
    const tierRevenue = { basic: 0, silver: 0, gold: 0 };
    for (const o of completed) {
      if (tierCounts[o.tier] !== undefined) {
        tierCounts[o.tier]++;
        tierRevenue[o.tier] = Math.round((tierRevenue[o.tier] + o.amount) * 100) / 100;
      }
    }

    const stats = {
      totalLeads: leads.length,
      paidLeads,
      conversionRate: leads.length ? Math.round((paidLeads / leads.length) * 1000) / 10 : 0,
      totalOrders: orders.length,
      completedOrders: completed.length,
      pendingOrders: enrichedOrders.filter(o => o.status === 'pending').length,
      failedOrders: enrichedOrders.filter(o => o.status === 'failed').length,
      refundedOrders: enrichedOrders.filter(o => o.status === 'refunded').length,
      revenue,
      avgOrderValue: completed.length ? Math.round((revenue / completed.length) * 100) / 100 : 0,
      leads24,
      orders24: last24.filter(o => o.status === 'completed').length,
      revenue24,
      tierCounts,
      tierRevenue,
      bumpFunnelCount: completed.filter(o => o.bumps.includes('Funnel Copy')).length,
      bumpPromptsCount: completed.filter(o => o.bumps.includes('AI Prompts')).length,
    };

    const enrichedLeads = leads.map(l => ({
      id: l.id,
      name: [l.first_name, l.last_name].filter(Boolean).join(' ') || '—',
      email: l.email,
      phone: fmtPhone(l.country_code, l.mobile),
      profession: l.profession || '—',
      converted: l.converted,
      createdAt: l.created_at,
    }));

    const recentEvents = (events || []).slice(0, 40).map(e => ({
      type: e.event_type,
      processed: e.processed,
      createdAt: e.created_at,
    }));

    // Funnel: leads -> checkouts initiated -> completed
    const funnel = [
      { stage: 'LEADS CAPTURED', n: leads.length },
      { stage: 'CHECKOUTS INITIATED', n: orders.length },
      { stage: 'PAYMENTS COMPLETED', n: completed.length },
    ];

    // Profession breakdown (top 6)
    const profCount = {};
    for (const l of leads) {
      const p = l.profession || 'Not specified';
      profCount[p] = (profCount[p] || 0) + 1;
    }
    const professions = Object.entries(profCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, n]) => ({ label, n }));

    const roadmaps = listRoadmaps();
    const roadmapStats = {
      total: roadmaps.length,
      new: roadmaps.filter(r => r.status === 'new').length,
      last24: roadmaps.filter(r => Date.now() - +new Date(r.createdAt) < DAY).length,
    };

    return res.json({
      ok: true,
      mode,
      settings: getSettings(),
      funnel,
      professions,
      roadmapStats,
      stats,
      series: buildSeries(leads, orders, 30),
      orders: enrichedOrders.slice(0, 200),
      leads: enrichedLeads.slice(0, 200),
      events: recentEvents,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
