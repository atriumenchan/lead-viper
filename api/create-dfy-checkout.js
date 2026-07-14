'use strict';

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const DFY_PRICES = {
  27: { tier: 'dfy-vault-27', name: 'DFY Vault Upgrade — Downsell' },
  49: { tier: 'dfy-vault-49', name: 'DFY Vault Upgrade' },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');
  const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

  if (!secret) return res.status(500).json({ error: 'Stripe not configured' });

  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const firstName = String(req.body?.firstName || '').trim().slice(0, 100);
    const price = Number(req.body?.price);
    const product = DFY_PRICES[price];

    if (!product || !email || !firstName) {
      return res.status(400).json({ error: 'Valid price, email and first name are required' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    let leadId = null;
    if (supabase) {
      const { data: lead } = await supabase.from('leads')
        .select('id')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      leadId = lead?.id || null;
      if (!leadId) {
        const { data: createdLead } = await supabase.from('leads').insert({
          first_name: firstName,
          last_name: '',
          email,
          mobile: '',
          country_code: '+1',
          profession: 'DFY Vault customer',
          converted: true,
        }).select('id').single();
        leadId = createdLead?.id || null;
      }
    }

    const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia' });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: price * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${siteUrl}/book-a-call?dfy_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dfy-checkout?price=${price}`,
      customer_email: email,
      allow_promotion_codes: true,
      metadata: {
        product: 'dfy-vault',
        tier: product.tier,
        first_name: firstName,
        lead_id: leadId || '',
      },
    });

    if (supabase) {
      await supabase.from('orders').insert({
        lead_id: leadId,
        stripe_session_id: session.id,
        tier: product.tier,
        amount_cents: price * 100,
        bump_funnel_copy: false,
        bump_ai_prompts: false,
        status: 'pending',
      });
    }

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[create-dfy-checkout]', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create DFY checkout session' });
  }
};
