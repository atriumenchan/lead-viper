'use strict';
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const BASE_PRICES = { 3: 'basic', 9: 'silver', 15: 'gold' };
const BUMP1_CENTS = 1200;
const BUMP2_CENTS = 1700;
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
  const SITE_URL                  = (process.env.SITE_URL || 'https://lead-engine.admexo.com').replace(/\/$/, '');

  if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
  const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  try {
    const { price, email, firstName, phone } = req.body;
    if (!price || !email || !firstName) return res.status(400).json({ error: 'price, email and firstName are required' });

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) return res.status(400).json({ error: 'Invalid price' });

    const { tier, bumpFunnel, bumpPrompts, baseCents } = inferTierAndBumps(priceNum);
    const totalCents = Math.round(priceNum * 100);

    // ── Duplicate prevention (before Stripe call) ─────────────────────────
    let lead_id = null;
    if (supabase) {
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('id, converted')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1);

      const existingLead = existingLeads?.[0] || null;

      if (existingLead?.converted === true) {
        return res.status(409).json({
          error: 'This email has already been used to purchase. Check your inbox for access details.',
        });
      }

      lead_id = existingLead?.id || null;

      if (!lead_id) {
        const { data: newLead, error: leadErr } = await supabase.from('leads').insert({
          first_name: firstName, last_name: '', email, mobile: phone || '', country_code: '+1', profession: 'Not specified', converted: false,
        }).select('id').single();
        if (!leadErr && newLead?.id) lead_id = newLead.id;
      }
    }

    const lineItems = [
      { price_data: { currency: 'usd', product_data: { name: TIER_NAMES[tier] || 'AI Lead Bundle' }, unit_amount: baseCents }, quantity: 1 },
    ];
    if (bumpFunnel)  lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'AI Funnel Copy Creation Agent (Order Bump)' }, unit_amount: BUMP1_CENTS }, quantity: 1 });
    if (bumpPrompts) lineItems.push({ price_data: { currency: 'usd', product_data: { name: 'AI Prompts That Build Your Offer (Order Bump)' }, unit_amount: BUMP2_CENTS }, quantity: 1 });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${SITE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
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
