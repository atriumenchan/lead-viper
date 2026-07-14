'use strict';
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const BASE_PRICES = { 3: 'basic', 9: 'silver', 15: 'gold' };
const BUMP1_CENTS = 1200;
const BUMP2_CENTS = 1700;
const TIER_NAMES  = {
  basic:  'AI Lead Engine — Basic (One-Time)',
  silver: 'AI Lead Engine — Silver (One-Time)',
  gold:   'AI Lead Engine — Gold (One-Time)',
};
const DFY_PRICES = {
  27: 'DFY Vault Upgrade — Downsell',
  49: 'DFY Vault Upgrade',
};

function inferTierAndBumps(priceUsd) {
  for (const [base, tier] of Object.entries(BASE_PRICES)) {
    const b = Number(base);
    for (const hasFunnel of [false, true]) {
      for (const hasPrompts of [false, true]) {
        const total = b + (hasFunnel ? 12 : 0) + (hasPrompts ? 17 : 0);
        if (total === priceUsd) return { tier, bumpFunnel: hasFunnel, bumpPrompts: hasPrompts, baseCents: b * 100 };
      }
    }
  }
  return { tier: 'basic', bumpFunnel: false, bumpPrompts: false, baseCents: priceUsd * 100 };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_SECRET_KEY         = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL              = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SITE_URL                  = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');

  if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
  const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  try {
    const { action, price, email, firstName, phone } = req.body;

    // ── DFY vault upsell checkout ($27 or $49) ─────────────────────────────
    if (action === 'dfy') {
      const priceNum = Number(price);
      const dfyName  = DFY_PRICES[priceNum];
      if (!dfyName || !email || !firstName) {
        return res.status(400).json({ error: 'Valid price (27 or 49), email and firstName are required' });
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      let leadId = null;
      if (supabase) {
        const { data: existing } = await supabase.from('leads')
          .select('id').eq('email', email.trim().toLowerCase())
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        leadId = existing?.id || null;
        if (!leadId) {
          const { data: created } = await supabase.from('leads').insert({
            first_name: firstName.trim().slice(0, 100), last_name: '', email: email.trim().toLowerCase(),
            mobile: '', country_code: '+1', profession: 'DFY Vault customer', converted: true,
          }).select('id').single();
          leadId = created?.id || null;
        }
      }

      const dfySession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', product_data: { name: dfyName }, unit_amount: priceNum * 100 }, quantity: 1 }],
        mode: 'payment',
        success_url: `${SITE_URL}/book-a-call?dfy_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${SITE_URL}/dfy-checkout?price=${priceNum}`,
        customer_email: email.trim().toLowerCase(),
        allow_promotion_codes: true,
        metadata: { product: 'dfy-vault', tier: `dfy-vault-${priceNum}`, first_name: firstName.trim(), lead_id: leadId || '' },
      });

      if (supabase && leadId) {
        await supabase.from('orders').insert({
          lead_id: leadId, stripe_session_id: dfySession.id,
          tier: `dfy-vault-${priceNum}`, amount_cents: priceNum * 100,
          bump_funnel_copy: false, bump_ai_prompts: false, status: 'pending',
        });
      }
      return res.json({ url: dfySession.url });
    }

    // ── Main product checkout ───────────────────────────────────────────────
    if (!price || !email || !firstName) return res.status(400).json({ error: 'price, email and firstName are required' });

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Invalid price' });

    const { tier, bumpFunnel, bumpPrompts, baseCents } = inferTierAndBumps(priceNum);
    const totalCents = Math.round(priceNum * 100);

    let lead_id = null;
    if (supabase) {
      const { data: convertedRows } = await supabase.from('leads').select('id').eq('email', email).eq('converted', true).limit(1);
      if (convertedRows && convertedRows.length > 0) {
        return res.status(409).json({ error: 'This email has already been used to purchase. Check your inbox for access details.' });
      }
      const { data: existingLeads } = await supabase.from('leads').select('id').eq('email', email).eq('converted', false).order('created_at', { ascending: false }).limit(1);
      lead_id = existingLeads?.[0]?.id || null;
      if (!lead_id) {
        const { data: newLead, error: leadErr } = await supabase.from('leads').insert({
          first_name: firstName, last_name: '', email, mobile: phone || '', country_code: '+1', profession: 'Not specified', converted: false,
        }).select('id').single();
        if (!leadErr && newLead?.id) lead_id = newLead.id;
      }
    }

    const lineItems = [
      { price_data: { currency: 'usd', product_data: { name: TIER_NAMES[tier] || 'AI Lead Engine' }, unit_amount: baseCents }, quantity: 1 },
    ];
    if (bumpFunnel)  lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'AI Funnel Copy Creation Agent (Order Bump)' }, unit_amount: BUMP1_CENTS }, quantity: 1 });
    if (bumpPrompts) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'AI Prompts That Build Your Offer (Order Bump)' }, unit_amount: BUMP2_CENTS }, quantity: 1 });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${SITE_URL}/dfy-one-time?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/checkout`,
      customer_email: email,
      allow_promotion_codes: true,
      metadata: { tier, first_name: firstName, phone: phone || '', bump_funnel_copy: bumpFunnel ? 'true' : 'false', bump_ai_prompts: bumpPrompts ? 'true' : 'false' },
    });

    if (supabase && lead_id) {
      await supabase.from('orders').insert({
        lead_id, stripe_session_id: session.id, tier, amount_cents: totalCents, bump_funnel_copy: bumpFunnel, bump_ai_prompts: bumpPrompts, status: 'pending',
      });
    }

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
};
