'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { data: lead } = await supabase.from('leads')
    .select('id, first_name, access_password, converted')
    .eq('email', email.toLowerCase().trim())
    .eq('access_password', password.trim())
    .limit(1)
    .single();

  if (!lead) return res.status(401).json({ error: 'Invalid email or password' });

  let tier = null;
  let bumpFunnel = false;
  let bumpPrompts = false;

  if (lead.converted) {
    const { data: order } = await supabase.from('orders')
      .select('tier, bump_funnel_copy, bump_ai_prompts')
      .eq('lead_id', lead.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (order) {
      tier = order.tier;
      bumpFunnel = order.bump_funnel_copy;
      bumpPrompts = order.bump_ai_prompts;
    }
  }

  return res.json({
    ok: true,
    firstName: lead.first_name,
    email,
    tier,
    bumpFunnel,
    bumpPrompts,
    converted: lead.converted,
  });
};
