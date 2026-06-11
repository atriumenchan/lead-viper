'use strict';
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

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
          const { data: updatedOrder } = await supabase.from('orders').update({ status: 'completed', stripe_payment_intent_id: session.payment_intent || '', updated_at: new Date().toISOString() })
            .eq('stripe_session_id', session.id).select('lead_id').single();
          if (updatedOrder?.lead_id) await supabase.from('leads').update({ converted: true }).eq('id', updatedOrder.lead_id);
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
