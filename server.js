'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const Stripe  = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// ── leadengine additions ───────────────────────────────────────────────────────
const adminHandler      = require('./lib/routes/admin');
const roadmapHandler    = require('./lib/routes/roadmap');
const uploadHandler     = require('./lib/routes/upload');
const chatbotHandler    = require('./lib/routes/chatbot');
const checkoutHandler   = require('./lib/routes/create-checkout');
const dashboardAuthHandler = require('./lib/routes/dashboard-auth');
const leadsHandler      = require('./lib/routes/leads');
const logOrderHandler   = require('./lib/routes/log-order');
const loginHandler      = require('./lib/routes/login');
const remindHandler     = require('./lib/routes/remind');
const sendWelcomeHandler = require('./lib/routes/send-welcome');
const webhookHandler    = require('./lib/routes/webhook');
const { requireAdmin, verifyToken, getAdminConfig, signToken } = require('./lib/auth');
const { getFilePath } = require('./lib/db');
const { LIVE }        = require('./lib/store');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3001;
const SITE_URL    = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const FRONTEND_DIR = process.env.FRONTEND_DIR ||
  path.join(__dirname, 'public');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY         = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET     = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY)         console.warn('WARNING: STRIPE_SECRET_KEY not set');
if (!SUPABASE_URL)              console.warn('WARNING: SUPABASE_URL not set');
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set');

// ── Clients (guarded against missing env vars) ───────────────────────────────
const stripe   = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
  : null;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ── Pricing maps ─────────────────────────────────────────────────────────────
const BASE_PRICES = { 3: 'basic', 9: 'silver', 15: 'gold' };
const BUMP1_CENTS = 1200;   // $12 funnel copy bump
const BUMP2_CENTS = 1700;   // $17 AI prompts bump
const TIER_NAMES  = {
  basic:  'AI Lead Engine — Basic (One-Time)',
  silver: 'AI Lead Engine — Silver (One-Time)',
  gold:   'AI Lead Engine — Gold (One-Time)',
};

function inferTierAndBumps(priceUsd) {
  for (const [base, tier] of Object.entries(BASE_PRICES)) {
    const b = Number(base);
    for (const hasFunnel of [false, true]) {
      for (const hasPrompts of [false, true]) {
        const total = b + (hasFunnel ? 12 : 0) + (hasPrompts ? 17 : 0);
        if (total === priceUsd) {
          return { tier, bumpFunnel: hasFunnel, bumpPrompts: hasPrompts, baseCents: b * 100 };
        }
      }
    }
  }
  // Unknown combination — treat as basic, use raw price
  return { tier: 'basic', bumpFunnel: false, bumpPrompts: false, baseCents: priceUsd * 100 };
}

// ── JS/HTML on-the-fly patches ────────────────────────────────────────────────
// 1. Supabase mock in main bundle  →  real client injected via CDN in HTML
const SUPA_MOCK_SEARCH =
  'ul={from:()=>({insert:async()=>({data:null,error:null}),' +
  'select:()=>({eq:()=>({single:async()=>({data:null,error:null})})})}),functions:{invoke:async()=>({data:null,error:new Error("disabled")})},' +
  'auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})},' +
  'channel:()=>({subscribe:()=>({}),unsubscribe:async()=>"ok"})}';
const SUPA_MOCK_REPLACE = 'ul=window.__supabase';

// 2. Checkout stub  →  real fetch to /api/create-checkout
const CHECKOUT_STUB_SEARCH  = 'H.error("Checkout is not available. Please contact support.")';
const CHECKOUT_STUB_REPLACE =
  'const _cr=await fetch("/api/create-checkout",{method:"POST",' +
  'headers:{"Content-Type":"application/json"},' +
  'body:JSON.stringify({price:u,email:o,firstName:l,phone:c})});' +
  'const _cd=await _cr.json();' +
  'if(!_cr.ok)throw new Error(_cd.error||"Checkout failed");' +
  'window.location.href=_cd.url';

// 3. logOrder stub  →  real fetch to /api/log-order
const LOG_ORDER_SEARCH  = 'async function l(){return{ok:!0}}async function d(){}export{d as f,l}';
const LOG_ORDER_REPLACE =
  'async function l(t){try{' +
  'const r=await fetch("/api/log-order",{method:"POST",' +
  'headers:{"Content-Type":"application/json"},body:JSON.stringify(t||{})});' +
  'return r.ok?r.json():{ok:!0}}catch{return{ok:!0}}}' +
  'async function d(){}export{d as f,l}';

// HTML injection: load Supabase CDN + create client before app bundle
const HTML_INJECT = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>\n` +
    `<script>window.__supabase=supabase.createClient("${SUPABASE_URL}","${SUPABASE_ANON_KEY}")</script>\n`
  : '';

const patchCache = new Map();

function getPatchedContent(absPath) {
  if (patchCache.has(absPath)) return patchCache.get(absPath);

  let content = fs.readFileSync(absPath, 'utf8');
  const fname = path.basename(absPath);
  let patched = false;

  if (fname === 'index.html' || fname === 'optin.html') {
    content = content.replace('</head>', HTML_INJECT + '</head>');
    patched = true;
  } else if (/^index-.*\.js$/.test(fname)) {
    if (content.includes(SUPA_MOCK_SEARCH)) {
      content = content.replace(SUPA_MOCK_SEARCH, SUPA_MOCK_REPLACE);
      console.log(`  [patch] Supabase mock replaced in ${fname}`);
      patched = true;
    } else {
      console.warn(`  [warn]  Supabase mock NOT found in ${fname} — may already be patched or bundle changed`);
    }
  } else if (/^Checkout-.*\.js$/.test(fname)) {
    if (content.includes(CHECKOUT_STUB_SEARCH)) {
      content = content.replace(CHECKOUT_STUB_SEARCH, CHECKOUT_STUB_REPLACE);
      console.log(`  [patch] Checkout stub replaced in ${fname}`);
      patched = true;
    } else {
      console.warn(`  [warn]  Checkout stub NOT found in ${fname}`);
    }
  } else if (/^logOrder-.*\.js$/.test(fname)) {
    if (content.includes(LOG_ORDER_SEARCH)) {
      content = content.replace(LOG_ORDER_SEARCH, LOG_ORDER_REPLACE);
      console.log(`  [patch] logOrder stub replaced in ${fname}`);
      patched = true;
    }
  }

  patchCache.set(absPath, content);
  return content;
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// Stripe webhook MUST receive raw body — register before express.json()
app.post('/api/webhook', express.raw({ type: '*/*' }), (req, res) => webhookHandler(req, res));

app.use(express.json({ limit: '18mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── Cookie parser ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const raw = req.headers.cookie || '';
  req.cookies = {};
  raw.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) req.cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  next();
});

// ── authGuard (admin routes) ──────────────────────────────────────────────────
function authGuard(req, res, next) {
  const token = req.cookies?.token || req.query.token;
  if (token && verifyToken(token, getAdminConfig().secret)) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  return res.redirect(`/login?to=${encodeURIComponent(req.originalUrl)}`);
}

// ── API routes ───────────────────────────────────────────────────────────────
app.post('/api/admin',         (req, res) => adminHandler(req, res));
app.post('/api/roadmap',       (req, res) => roadmapHandler(req, res));
app.post('/api/upload',        (req, res) => uploadHandler(req, res));
app.post('/api/chatbot',       (req, res) => chatbotHandler(req, res));
app.post('/api/create-checkout', (req, res) => checkoutHandler(req, res));
app.post('/api/dashboard-auth',  (req, res) => dashboardAuthHandler(req, res));
app.post('/api/leads',         (req, res) => leadsHandler(req, res));
app.post('/api/log-order',     (req, res) => logOrderHandler(req, res));
app.post('/api/login',         (req, res) => loginHandler(req, res));
app.get('/api/remind',         (req, res) => remindHandler(req, res));
app.post('/api/send-welcome',  (req, res) => sendWelcomeHandler(req, res));

app.get('/api/file/:id', (req, res) => {
  if (!requireAdmin(req.query.token)) return res.status(401).json({ error: 'Unauthorized' });
  const f = getFilePath(req.params.id);
  if (!f) return res.status(404).json({ error: 'File not found' });
  return res.download(f.path, f.meta.name);
});

// ── Page routes ───────────────────────────────────────────────────────────────
app.get('/home',   (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/login',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/access', (req, res) => res.sendFile(path.join(__dirname, 'public', 'access.html')));
app.get('/admin',   authGuard, (req, res) => res.sendFile(path.join(__dirname, 'public', 'control.html')));
app.get('/roadmap', (req, res) => res.sendFile(path.join(__dirname, 'public', 'roadmap.html')));

// Static assets bypass patching for speed
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ── POST /api/webhook (Stripe) ────────────────────────────────────────────────
async function handleWebhook(req, res) {
  if (!stripe)   return res.status(503).json({ error: 'Stripe not configured' });
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  const sig = req.headers['stripe-signature'];

  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping verification');
    return res.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency — skip duplicate events
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();
  if (existing) return res.json({ received: true, duplicate: true });

  // Log raw event
  await supabase.from('webhook_events').insert({
    stripe_event_id: event.id,
    event_type:      event.type,
    payload:         event,
    processed:       false,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { data: updatedOrder } = await supabase
          .from('orders')
          .update({
            status:                      'completed',
            stripe_payment_intent_id:    session.payment_intent || '',
            updated_at:                  new Date().toISOString(),
          })
          .eq('stripe_session_id', session.id)
          .select('lead_id')
          .single();

        if (updatedOrder?.lead_id && session.metadata?.product !== 'dfy-vault') {
          const accessPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
          await supabase.from('leads').update({ converted: true, access_password: accessPassword }).eq('id', updatedOrder.lead_id);
          console.log(`[webhook] access_password set for lead ${updatedOrder.lead_id}`);
        }

        console.log(`[webhook] payment completed — session ${session.id} | ${session.customer_email}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        await supabase
          .from('orders')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', intent.id);
        break;
      }

      case 'charge.refunded': {
        const charge    = event.data.object;
        const intentId  = typeof charge.payment_intent === 'string' ? charge.payment_intent : '';
        if (intentId) {
          await supabase
            .from('orders')
            .update({ status: 'refunded', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent_id', intentId);
        }
        break;
      }
    }

    await supabase
      .from('webhook_events')
      .update({ processed: true })
      .eq('stripe_event_id', event.id);

    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// ── Static file serving with on-the-fly patches ───────────────────────────────
app.get('*', (req, res) => {
  const urlPath  = req.path;
  const filePath = path.join(FRONTEND_DIR, urlPath);

  // File exists on disk?
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.html' || ext === '.js') {
      try {
        const content  = getPatchedContent(filePath);
        const mimeType = ext === '.html' ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'no-cache'); // always fresh during dev
        return res.send(content);
      } catch (err) {
        console.error('[serve]', err.message);
        return res.sendFile(filePath);
      }
    }

    return res.sendFile(filePath);
  }

  // Missing JS chunk (DfyCheckout, BookACall, etc.) — return empty module to prevent crash
  if (urlPath.startsWith('/assets/') && urlPath.endsWith('.js')) {
    console.warn(`[missing chunk] ${urlPath} — serving empty module`);
    res.setHeader('Content-Type', 'application/javascript');
    return res.send('export default function(){return null}');
  }

  // SPA fallback — serve index.html for all unknown routes
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    try {
      const content = getPatchedContent(indexPath);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(content);
    } catch (err) {
      return res.status(500).send('Server error');
    }
  }

  return res.status(404).send('Not found');
});

// ── Start (local dev) / Export (Vercel serverless) ───────────────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(' AI Lead Engine — Unified Server');
    console.log(` http://localhost:${PORT}`);
    console.log(`  Supabase : ${SUPABASE_URL ? 'connected' : 'not configured'}`);
    console.log(`  Stripe   : ${STRIPE_SECRET_KEY ? (STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST') : 'not configured'}`);
    console.log(`  Data     : ${LIVE ? 'Supabase' : 'Demo mode'}`);
    console.log('========================================\n');
  });
}

module.exports = app;
