'use strict';
// Roadmap API — Supabase-backed with async DeepSeek enrichment.
//   POST { action:'create', ...businessInfo }  -> { ok, id, status }
//   POST { action:'get', id }                  -> { ok, plan, status }
//   POST { action:'enrichment', id }           -> { ok, enrichment, leads }
//   POST { action:'enrich', id, apiKey }       -> { ok, status }
// Admin (token required):
//   POST { action:'list', token }              -> { ok, submissions }
//   POST { action:'mark', token, id, status }  -> { ok }

const crypto = require('crypto');
const { generatePlan } = require('../planner');
const { saveRoadmap, getRoadmap, listRoadmaps, updateRoadmap, getLeads } = require('../supabase');
const { requireAdmin } = require('../auth');
const { getSettings } = require('../db');

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 600000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

const str = (v, max = 300) => String(v ?? '').trim().slice(0, max);

module.exports = async function handler(req, res) {
  try {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const action = body.action;

  // ── create (public) ────────────────────────────────────────────────────────
  if (action === 'create') {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (rateLimited(String(ip))) return res.status(429).json({ error: 'Too many requests — try again later' });

    const email = str(body.email, 200).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!str(body.businessName)) return res.status(400).json({ error: 'Business name is required' });

    const input = {
      name: str(body.name, 120),
      email,
      businessName: str(body.businessName, 120),
      website: str(body.website, 200),
      niche: str(body.niche, 30),
      audience: str(body.audience, 300),
      offer: str(body.offer, 300),
      pricePoint: Number(body.pricePoint) || 0,
      monthlyGoal: Number(body.monthlyGoal) || 0,
      channels: Array.isArray(body.channels) ? body.channels.map((c) => str(c, 20)).slice(0, 6) : [],
      tone: ['professional', 'bold', 'friendly'].includes(body.tone) ? body.tone : 'professional',
      challenge: str(body.challenge, 500),
    };

    const id = crypto.randomBytes(8).toString('hex');
    const now = new Date().toISOString();

    // Generate the plan immediately so the user never waits
    const plan = generatePlan(input);

    await saveRoadmap({
      id,
      input,
      plan,
      enrichment: null,
      status: 'ready',
      createdAt: now,
      readyAt: now,
    });

    // Fire async enrichment in background if configured (enhances the plan later)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (input.website && apiKey) {
      const { enrichRoadmapAsync } = require('../enricher');
      enrichRoadmapAsync(id, apiKey).catch(() => {});
    }

    return res.json({ ok: true, id, readyAt: now, status: 'ready' });
  }

  // ── get (public, by id) ────────────────────────────────────────────────────
  if (action === 'get') {
    const entry = await getRoadmap(str(body.id, 40));
    if (!entry) return res.status(404).json({ error: 'Plan not found' });
    const readyAt = entry.readyAt || entry.createdAt;
    const isAdmin = requireAdmin(body.token);

    if (entry.status === 'processing' && !isAdmin) {
      return res.json({ ok: true, id: entry.id, status: 'processing', readyAt, createdAt: entry.createdAt });
    }

    if (!isAdmin && Date.now() < +new Date(readyAt)) {
      return res.json({ ok: true, id: entry.id, pending: true, readyAt, createdAt: entry.createdAt });
    }

    return res.json({
      ok: true, id: entry.id, plan: entry.plan, enrichment: entry.enrichment,
      status: entry.status, createdAt: entry.createdAt, readyAt,
    });
  }

  // ── enrichment (public, by roadmap id) ─────────────────────────────────────
  if (action === 'enrichment') {
    const entry = await getRoadmap(str(body.id, 40));
    if (!entry) return res.json({ ok: true, enrichment: null, leads: [], status: 'not_found' });
    const leads = await getLeads(str(body.id, 40));
    return res.json({
      ok: true, enrichment: entry.enrichment || null, leads: leads || [], status: entry.status || 'unknown',
    });
  }

  // ── trigger enrichment manually ────────────────────────────────────────────
  if (action === 'enrich') {
    const rid = str(body.id, 40);
    const apiKey = body.apiKey || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'DeepSeek API key required' });
    const { enrichRoadmapAsync } = require('../enricher');
    enrichRoadmapAsync(rid, apiKey).catch(() => {});
    return res.json({ ok: true, status: 'enrichment_started', id: rid });
  }

  // ── admin actions ──────────────────────────────────────────────────────────
  if (!requireAdmin(body.token)) return res.status(401).json({ error: 'Unauthorized' });

  if (action === 'list') {
    const submissions = await listRoadmaps();
    const mapped = submissions.map((r) => ({
      id: r.id, name: r.input?.name || '', email: r.input?.email || '',
      business: r.input?.businessName || '', website: r.input?.website || '',
      niche: r.plan?.business?.nicheLabel || r.input?.niche || '',
      goal: r.input?.monthlyGoal || 0, channels: r.input?.channels || [],
      challenge: r.input?.challenge || '', status: r.status || 'new', createdAt: r.createdAt,
    }));
    return res.json({ ok: true, submissions: mapped });
  }

  if (action === 'mark') {
    const status = ['new', 'contacted', 'converted'].includes(body.status) ? body.status : 'new';
    const updated = await updateRoadmap(str(body.id, 40), { status });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('[roadmap] unhandled error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
