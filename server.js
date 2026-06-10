'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const Stripe  = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3001;
const SITE_URL    = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const FRONTEND_DIR = process.env.FRONTEND_DIR ||
  path.join(__dirname, '..', 'website', 'aileadbundle',
    'source code', 'aileadbundle.com', 'aileadbundle.com', 'leadengine.admexo.com');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY         = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET     = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY)         throw new Error('Missing STRIPE_SECRET_KEY in .env');
if (!SUPABASE_URL)              throw new Error('Missing SUPABASE_URL in .env');
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');

// ── Clients ───────────────────────────────────────────────────────────────────
const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Pricing maps ─────────────────────────────────────────────────────────────
const BASE_PRICES = { 3: 'basic', 9: 'silver', 15: 'gold' };
const BUMP1_CENTS = 1200;   // $12 funnel copy bump
const BUMP2_CENTS = 1700;   // $17 AI prompts bump
const TIER_NAMES  = {
  basic:  'AI Lead Bundle — Basic (One-Time)',
  silver: 'AI Lead Bundle — Silver (One-Time)',
  gold:   'AI Lead Bundle — Gold (One-Time)',
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
const HTML_INJECT =
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>\n` +
  `<script>window.__supabase=supabase.createClient("${SUPABASE_URL}","${SUPABASE_ANON_KEY}")</script>\n`;

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

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post('/api/webhook', express.raw({ type: '*/*' }), handleWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── POST /api/create-checkout ─────────────────────────────────────────────────
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { price, email, firstName, phone } = req.body;

    if (!price || !email || !firstName) {
      return res.status(400).json({ error: 'price, email and firstName are required' });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const { tier, bumpFunnel, bumpPrompts, baseCents } = inferTierAndBumps(priceNum);
    const totalCents = Math.round(priceNum * 100);

    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: TIER_NAMES[tier] || 'AI Lead Bundle' },
          unit_amount: baseCents,
        },
        quantity: 1,
      },
    ];

    if (bumpFunnel) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'AI Funnel Copy Creation Agent (Order Bump)' },
          unit_amount: BUMP1_CENTS,
        },
        quantity: 1,
      });
    }

    if (bumpPrompts) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'AI Prompts That Build Your Offer (Order Bump)' },
          unit_amount: BUMP2_CENTS,
        },
        quantity: 1,
      });
    }

    // ── 1. Insert lead (matches existing schema: last_name, mobile, country_code, profession required) ──
    let lead_id = null;
    const { data: leadData, error: leadErr } = await supabase.from('leads').insert({
      first_name:   firstName,
      last_name:    '',
      email,
      mobile:       phone || '',
      country_code: '+1',
      profession:   'Not specified',
      converted:    false,
    }).select('id').single();

    if (leadErr) {
      console.error('[supabase] lead insert error:', leadErr.message);
    } else {
      lead_id = leadData.id;
    }

    // ── 2. Create Stripe Checkout Session ──
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${SITE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/checkout`,
      customer_email: email,
      allow_promotion_codes: true,
      metadata: {
        tier,
        first_name:       firstName,
        phone:            phone || '',
        bump_funnel_copy: bumpFunnel  ? 'true' : 'false',
        bump_ai_prompts:  bumpPrompts ? 'true' : 'false',
      },
    });

    // ── 3. Persist pending order (matches existing schema: lead_id FK required) ──
    if (lead_id) {
      const { error: dbErr } = await supabase.from('orders').insert({
        lead_id,
        stripe_session_id:  session.id,
        tier,
        amount_cents:       totalCents,
        bump_funnel_copy:   bumpFunnel,
        bump_ai_prompts:    bumpPrompts,
        status:             'pending',
      });
      if (dbErr) console.error('[supabase] order insert error:', dbErr.message);
    } else {
      console.warn('[supabase] order not saved — lead insert failed');
    }

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
});

// ── POST /api/log-order ───────────────────────────────────────────────────────
app.post('/api/log-order', async (req, res) => {
  try {
    console.log('[log-order]', req.body);
    return res.json({ ok: true });
  } catch {
    return res.json({ ok: true });
  }
});

// ── POST /api/leads ───────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  try {
    const { email, firstName, first_name, phone, mobile } = req.body;
    const nameVal  = firstName || first_name || '';
    const phoneVal = phone || mobile || '';

    if (!email) return res.status(400).json({ error: 'email is required' });

    const { data, error } = await supabase.from('leads').insert({
      email,
      first_name: nameVal,
      phone:      phoneVal,
    }).select('id').single();

    if (error) {
      console.error('[leads]', error.message);
      return res.status(500).json({ error: 'Failed to save lead' });
    }

    return res.json({ success: true, lead_id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/webhook (Stripe) ────────────────────────────────────────────────
async function handleWebhook(req, res) {
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

        // Mark lead as converted
        if (updatedOrder?.lead_id) {
          await supabase.from('leads').update({ converted: true }).eq('id', updatedOrder.lead_id);
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log(` AI Lead Bundle backend`);
  console.log(` http://localhost:${PORT}`);
  console.log('========================================');
  console.log(` Frontend : ${FRONTEND_DIR}`);
  console.log(` Supabase : ${SUPABASE_URL}`);
  console.log(` Stripe   : ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST'} mode`);
  console.log('========================================\n');
});
