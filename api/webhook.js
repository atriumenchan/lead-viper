'use strict';
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { buildWelcomeEmail, sendEmail } = require('./_email');

const TIER_LABELS = { basic: 'Basic', silver: 'Silver', gold: 'Gold' };

async function sendPurchaseEmail({ email, firstName, tier, password, dashboardUrl, bumpFunnel, bumpPrompts }) {
  const tierLabel = TIER_LABELS[tier] || tier;
  const bumps = [bumpFunnel && 'AI Funnel Copy Creation Agent', bumpPrompts && 'AI Prompts That Build Your Offer'].filter(Boolean);
  const { subject, html, text } = buildWelcomeEmail({ firstName, email, password, tierLabel, bumps });
  await sendEmail({ to: email, subject, html, text });
}

module.exports.config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const STRIPE_SECRET_KEY         = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET     = process.env.STRIPE_WEBHOOK_SECRET;
  const SUPABASE_URL              = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
  const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  const sig     = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (supabase) {
    const { data: existing } = await supabase.from('webhook_events').select('id').eq('stripe_event_id', event.id).single();
    if (existing) return res.json({ received: true, duplicate: true });

    await supabase.from('webhook_events').insert({ stripe_event_id: event.id, event_type: event.type, payload: event, processed: false });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (supabase) {
          const { data: updatedOrder } = await supabase.from('orders')
            .update({ status: 'completed', stripe_payment_intent_id: session.payment_intent || '', updated_at: new Date().toISOString() })
            .eq('stripe_session_id', session.id)
            .select('lead_id, tier, bump_funnel_copy, bump_ai_prompts')
            .single();

          if (updatedOrder?.lead_id) {
            await supabase.from('leads').update({ converted: true }).eq('id', updatedOrder.lead_id);

            if (session.metadata?.product === 'dfy-vault') break;

            const { data: lead } = await supabase.from('leads')
              .select('email, first_name, access_password')
              .eq('id', updatedOrder.lead_id)
              .single();

            if (lead?.email) {
              const SITE_URL = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');
              let password = lead.access_password;
              if (!password) {
                password = crypto.randomBytes(4).toString('hex').toUpperCase();
                await supabase.from('leads').update({ access_password: password }).eq('id', updatedOrder.lead_id);
              }
              try {
                await sendPurchaseEmail({
                  email: lead.email,
                  firstName: lead.first_name || 'there',
                  tier: updatedOrder.tier,
                  password,
                  dashboardUrl: `${SITE_URL}/dashboard`,
                  bumpFunnel: updatedOrder.bump_funnel_copy,
                  bumpPrompts: updatedOrder.bump_ai_prompts,
                });
                console.log(`[webhook] purchase email sent to ${lead.email}`);
              } catch (mailErr) {
                console.error('[webhook] email failed:', mailErr.message);
              }
            }
          }
        }
        console.log(`[webhook] completed: ${session.id}`);
        break;
      }
      case 'payment_intent.payment_failed': {
        if (supabase) {
          const intent = event.data.object;
          await supabase.from('orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('stripe_payment_intent_id', intent.id);
        }
        break;
      }
      case 'charge.refunded': {
        if (supabase) {
          const charge = event.data.object;
          const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : '';
          if (intentId) await supabase.from('orders').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('stripe_payment_intent_id', intentId);
        }
        break;
      }
    }

    if (supabase) await supabase.from('webhook_events').update({ processed: true }).eq('stripe_event_id', event.id);
    return res.json({ received: true });
  } catch (err) {
    console.error('[webhook] error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
