'use strict';
// Sends the branded "AI Lead Engine" welcome email for a given lead.
// Looks up the lead in Supabase so credentials are always accurate.
//
// Usage (GET or POST):
//   /api/send-welcome?email=<lead email>&proof=<lead access_password>&to=<recipient>
//
// - `email`  : the lead to build the welcome email for (uses their real password).
// - `proof`  : must equal that lead's access_password (simple guard, no new env var).
// - `to`     : optional override recipient (e.g. office@admexo.com for review).
//              Defaults to the lead's own email.

const { createClient } = require('@supabase/supabase-js');
const { buildWelcomeEmail, sendEmail } = require('../email');

const TIER_LABELS = { basic: 'Basic', silver: 'Silver', gold: 'Gold' };

module.exports = async function handler(req, res) {
  const q = { ...(req.query || {}), ...(req.body || {}) };
  const email = (q.email || '').trim();
  const proof = (q.proof || '').trim();
  const to    = (q.to || '').trim();

  if (!email || !proof) {
    return res.status(400).json({ error: 'Pass ?email=<lead email>&proof=<access_password>&to=<recipient>' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch the most recent matching lead.
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, first_name, email, access_password, converted')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  const lead = leads && leads[0];
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.access_password || proof !== lead.access_password) {
    return res.status(403).json({ error: 'Invalid proof' });
  }

  // Pull tier + bumps from their latest order, if available.
  let tierLabel, bumps = [];
  const { data: orders } = await supabase
    .from('orders')
    .select('tier, bump_funnel_copy, bump_ai_prompts, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (orders && orders[0]) {
    tierLabel = TIER_LABELS[orders[0].tier] || orders[0].tier;
    if (orders[0].bump_funnel_copy) bumps.push('AI Funnel Copy Creation Agent');
    if (orders[0].bump_ai_prompts)  bumps.push('AI Prompts That Build Your Offer');
  }

  const { subject, html, text } = buildWelcomeEmail({
    firstName: lead.first_name || 'there',
    email: lead.email,
    password: lead.access_password,
    tierLabel,
    bumps,
  });

  const recipient = to || lead.email;
  try {
    const result = await sendEmail({ to: recipient, subject, html, text });
    return res.json({ ok: true, sentTo: recipient, leadEmail: lead.email, messageId: result.MessageId });
  } catch (err) {
    console.error('[send-welcome]', err);
    return res.status(500).json({ error: err.message, code: err.name });
  }
};
