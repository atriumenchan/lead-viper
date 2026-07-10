'use strict';
// Data provider for the Control Center.
// LIVE mode  : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set -> queries the real
//              ai-lead-backend schema (leads, orders, webhook_events).
// DEMO mode  : no Supabase env -> deterministic seeded demo data with a live
//              drift simulation so the cockpit feels real during testing.

const crypto = require('crypto');
const { getSettings } = require('./db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let supabase = null;
if (LIVE) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── Demo data generation (seeded PRNG for reproducibility) ───────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ava','Liam','Noah','Mia','Ethan','Zoe','Lucas','Aria','Kai','Nora','Owen','Ivy','Leo','Ruby','Max','Elena','Jack','Lily','Ryan','Maya','Sam','Tara','Nick','Priya','Omar','Dana','Chris','Nina','Alex','Sara'];
const LAST  = ['Carter','Nguyen','Patel','Kim','Lopez','Shaw','Mehta','Brooks','Reed','Silva','Khan','Ford','Diaz','Wolfe','Bond','Rao','Hale','Cruz','Nash','Vale'];
const PROFESSIONS = ['Agency Owner','Coach','Consultant','Freelancer','Realtor','SaaS Founder','Marketer','Ecom Seller','Not specified'];
const TIERS = ['basic','silver','gold'];
const TIER_PRICE = { basic: 3, silver: 9, gold: 15 };

function buildDemoData() {
  const rand = mulberry32(20260706);
  const now = Date.now();
  const DAY = 86400000;
  const leads = [];
  const orders = [];
  const events = [];

  const N = 240; // leads over last 30 days
  for (let i = 0; i < N; i++) {
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 30);
    const created = new Date(now - daysAgo * DAY - rand() * DAY);
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const id = crypto.createHash('md5').update('lead' + i).digest('hex').slice(0, 8) + '-demo';
    const willConvert = rand() < 0.34;

    const lead = {
      id,
      first_name: first,
      last_name: last,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      mobile: `55501${String(1000 + Math.floor(rand() * 8999))}`,
      country_code: '+1',
      profession: PROFESSIONS[Math.floor(rand() * PROFESSIONS.length)],
      converted: false,
      access_password: null,
      created_at: created.toISOString(),
    };

    if (willConvert || rand() < 0.12) {
      const tier = TIERS[Math.floor(rand() * (rand() < 0.5 ? 1 : 3))]; // basic-heavy
      const bumpFunnel = rand() < 0.22;
      const bumpPrompts = rand() < 0.16;
      const amount = TIER_PRICE[tier] + (bumpFunnel ? 12 : 0) + (bumpPrompts ? 17 : 0);
      const r = rand();
      const status = willConvert ? 'completed' : (r < 0.55 ? 'pending' : (r < 0.85 ? 'failed' : 'refunded'));
      const orderCreated = new Date(created.getTime() + rand() * 3600000);

      orders.push({
        id: crypto.createHash('md5').update('order' + i).digest('hex').slice(0, 8) + '-demo',
        lead_id: id,
        tier,
        amount_cents: amount * 100,
        bump_funnel_copy: bumpFunnel,
        bump_ai_prompts: bumpPrompts,
        status,
        stripe_session_id: 'cs_demo_' + crypto.randomBytes(8).toString('hex'),
        created_at: orderCreated.toISOString(),
        updated_at: orderCreated.toISOString(),
      });

      if (status === 'completed') {
        lead.converted = true;
        lead.access_password = crypto.randomBytes(4).toString('hex').toUpperCase();
      }

      events.push({
        id: 'evt-' + i,
        event_type: status === 'completed' ? 'checkout.session.completed'
          : status === 'failed' ? 'payment_intent.payment_failed'
          : status === 'refunded' ? 'charge.refunded' : 'checkout.session.created',
        processed: status !== 'pending',
        created_at: orderCreated.toISOString(),
      });
    }

    leads.push(lead);
  }

  leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { leads, orders, events };
}

let demo = null;
function getDemo() {
  if (!demo) demo = buildDemoData();
  return demo;
}

// ── Public API ────────────────────────────────────────────────────────────────
async function fetchAll() {
  if (LIVE) {
    const [{ data: leads, error: le }, { data: orders, error: oe }, { data: events }] = await Promise.all([
      supabase.from('leads')
        .select('id, first_name, last_name, email, mobile, country_code, profession, converted, access_password, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('orders')
        .select('id, lead_id, tier, amount_cents, bump_funnel_copy, bump_ai_prompts, status, stripe_session_id, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase.from('webhook_events')
        .select('id, event_type, processed, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    if (le) throw new Error('leads query failed: ' + le.message);
    if (oe) throw new Error('orders query failed: ' + oe.message);
    return { leads: leads || [], orders: orders || [], events: events || [], mode: 'live' };
  }
  if (getSettings().demoMode) {
    const d = getDemo();
    return { leads: d.leads, orders: d.orders, events: d.events, mode: 'demo' };
  }
  // Demo disabled and no Supabase configured -> empty live-style dataset
  return { leads: [], orders: [], events: [], mode: 'offline' };
}

module.exports = { fetchAll, LIVE };
