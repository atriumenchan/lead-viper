'use strict';
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const crypto = require('crypto');

const TIER_LABELS = { basic: 'Basic', silver: 'Silver', gold: 'Gold' };

function getSESClient() {
  return new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-2',
    credentials: {
      accessKeyId:     process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });
}

async function sendPurchaseEmail({ email, firstName, tier, password, dashboardUrl, bumpFunnel, bumpPrompts }) {
  const ses = getSESClient();
  const tierLabel = TIER_LABELS[tier] || tier;
  const bumps = [bumpFunnel && 'AI Funnel Copy Creation Agent', bumpPrompts && 'AI Prompts That Build Your Offer'].filter(Boolean);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px">
  <tr><td style="background:#1a1a2e;padding:32px 40px;text-align:center">
    <h1 style="color:#f0a500;margin:0;font-size:24px">🎉 You're In! Your AI Lead Bundle Is Ready</h1>
  </td></tr>
  <tr><td style="padding:32px 40px">
    <p style="color:#333;font-size:16px;margin:0 0 16px">Hi ${firstName},</p>
    <p style="color:#333;font-size:16px;margin:0 0 24px">Your payment was successful. You've unlocked the <strong>${tierLabel} Plan</strong>${bumps.length ? ' + ' + bumps.join(' + ') : ''}.</p>
    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="color:#666;font-size:14px;margin:0 0 8px">Your dashboard login credentials:</p>
      <p style="margin:4px 0;font-size:15px"><strong>Email:</strong> ${email}</p>
      <p style="margin:4px 0;font-size:15px"><strong>Password:</strong> <span style="font-family:monospace;background:#e9ecef;padding:2px 8px;border-radius:4px">${password}</span></p>
    </div>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${dashboardUrl}" style="display:inline-block;background:#f0a500;color:#1a1a2e;font-weight:bold;font-size:16px;padding:16px 40px;border-radius:8px;text-decoration:none">Access Your Dashboard →</a>
    </td></tr></table>
    <p style="color:#999;font-size:13px;margin:24px 0 0;text-align:center">Save this email — you'll need it to log back in.</p>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:20px 40px;text-align:center">
    <p style="color:#999;font-size:12px;margin:0">AI Lead Bundle · <a href="https://leadengine.admexo.com" style="color:#f0a500">leadengine.admexo.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await ses.send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: `🎉 Your AI Lead Bundle ${tierLabel} Access Is Ready` },
      Body: { Html: { Data: html }, Text: { Data: `Hi ${firstName},\n\nYour AI Lead Bundle ${tierLabel} is ready.\n\nDashboard: ${dashboardUrl}\nEmail: ${email}\nPassword: ${password}\n\nSave this email to log back in.` } },
    },
  }));
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
