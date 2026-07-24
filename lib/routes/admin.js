'use strict';
// Control Center API — action-based, mirrors ai-lead-backend/api/admin.js contract:
//   POST { action:'login', email, password }  -> { ok, token }
//   POST { action:'data',  token }            -> { ok, mode, stats, series, orders, leads, events }
//   POST { action:'send-announcement', token, dry } -> { ok, sent, total, errors? }
//
// Env:
//   ADMIN_EMAIL    (default: admin@admexo.com)
//   ADMIN_PASSWORD (default: AdmExo@Admin2026!)
//   ADMIN_SECRET   (token signing secret)

const { fetchAll } = require('../store');
const { getAdminConfig, signToken, verifyToken } = require('../auth');
const { getSettings, setSettings, listRoadmaps } = require('../db');
const { sendEmail } = require('../email');

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

  if (action === 'send-announcement') {
    const { createClient } = require('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const SITE_URL = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');
    const dashboardUrl = `${SITE_URL}/access`;
    const dry = body.dry === true;

    function excluded(email) {
      const e = String(email || '').trim().toLowerCase();
      if (!e || !e.includes('@')) return true;
      const [local, domain] = e.split('@');
      if (domain === 'admexo.com' || domain === 'example.com') return true;
      return /^(test|testuser|user|demo|qa|sample)\d*$/.test(local);
    }

    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function buildAnnouncement(firstName) {
      const name = firstName || 'there';
      const subject = 'Three new resources are now available inside your AI Lead Engine';
      const text = `Hi ${name},\n\nWe've added three valuable resources to your AI Lead Engine dashboard:\n\n1. Personalized 21 Leads in 21 Days Planner\n\nCreate a practical action plan based on your business, niche, offer, and current lead-generation goals.\n\n2. Landing Page and Funnel Template Library\n\nYou now have access to landing page, sales page, funnel, Elementor, and WordPress templates to help you build faster and avoid starting every page from a blank canvas.\n\n3. 500+ Meta Ads Editable Templates\n\n500+ ready-to-edit Canva ad templates across text-based, image-based, niche-specific and seasonal categories. Open, swap your copy, and publish.\n\nLog in here to access everything:\n${dashboardUrl}\n\nThese resources are included with your existing access. No additional payment is required.\n\nTo your success,\nTeam ADMEXO\nAI & Performance Marketing Experts`;
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:32px 12px;background:#f5f5f7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ececf0"><tr><td style="background:#0F172A;padding:22px 32px;font:700 18px Arial;color:#fff">AI Lead Engine</td></tr><tr><td style="padding:32px;font:15px/1.65 Arial;color:#222"><h1 style="font-size:22px;color:#0F172A">Three new resources are ready for you</h1><p>Hi ${escapeHtml(name)},</p><p>We've added three valuable resources to your AI Lead Engine dashboard:</p><h2 style="font-size:17px;color:#0F172A">1. Personalized 21 Leads in 21 Days Planner</h2><p>Create a practical action plan based on your business, niche, offer, and current lead-generation goals.</p><h2 style="font-size:17px;color:#0F172A">2. Landing Page and Funnel Template Library</h2><p>You now have access to landing page, sales page, funnel, Elementor, and WordPress templates to help you build faster and avoid starting every page from a blank canvas.</p><h2 style="font-size:17px;color:#0F172A">3. 500+ Meta Ads Editable Templates</h2><p>500+ ready-to-edit Canva ad templates across text-based, image-based, niche-specific and seasonal categories. Open, swap your copy, and publish.</p><p style="text-align:center;margin:28px 0"><a href="${dashboardUrl}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open My Dashboard &rarr;</a></p><p>These resources are included with your existing access. No additional payment is required.</p><p>To your success,<br><strong>Team ADMEXO</strong><br>AI &amp; Performance Marketing Experts</p></td></tr></table></td></tr></table></body></html>`;
      return { subject, html, text };
    }

    const { data: orders, error: orderError } = await supabase.from('orders')
      .select('lead_id').eq('status', 'completed').not('lead_id', 'is', null);
    if (orderError) return res.status(500).json({ error: orderError.message });

    const leadIds = [...new Set((orders || []).map(o => o.lead_id))];
    if (!leadIds.length) return res.json({ ok: true, sent: 0, total: 0, message: 'No completed purchasers found.' });

    const { data: leads, error: leadError } = await supabase.from('leads')
      .select('email, first_name').in('id', leadIds);
    if (leadError) return res.status(500).json({ error: leadError.message });

    const recipients = [...new Map(
      (leads || []).filter(l => !excluded(l.email)).map(l => [l.email.trim().toLowerCase(), l])
    ).values()];

    if (dry) {
      return res.json({ ok: true, dryRun: true, total: recipients.length, recipients: recipients.map(l => l.email) });
    }

    let sent = 0;
    const errors = [];
    for (const lead of recipients) {
      try {
        const { subject, html, text } = buildAnnouncement(lead.first_name);
        await sendEmail({ to: lead.email.trim().toLowerCase(), subject, html, text });
        sent++;
      } catch (err) {
        errors.push({ email: lead.email, error: err.message });
      }
    }

    return res.json({ ok: true, sent, total: recipients.length, errors: errors.length ? errors : undefined });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
