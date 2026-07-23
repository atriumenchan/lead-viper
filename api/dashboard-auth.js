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
  let dfyVault = false;
  let purchasedVaultItems = [];

  if (lead.converted) {
    const { data: orders } = await supabase.from('orders')
      .select('tier, bump_funnel_copy, bump_ai_prompts, status')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    const completed = (orders || []).filter(o => o.status === 'completed');
    const allOrders = orders || [];
    const isSpecial = o => o.tier && (o.tier.startsWith('dfy-vault') || o.tier.startsWith('vault-item-'));

    // DFY Vault upgrade ($27 or $49) — check completed first, fall back to any order
    if (
      completed.some(o => o.tier && o.tier.startsWith('dfy-vault')) ||
      allOrders.some(o => o.tier && o.tier.startsWith('dfy-vault'))
    ) {
      dfyVault = true;
    }

    // Individually-purchased vault items ($5 each) — completed orders only
    purchasedVaultItems = completed
      .filter(o => o.tier && o.tier.startsWith('vault-item-'))
      .map(o => o.tier.replace('vault-item-', ''));

    // Main product order — prefer completed, fall back to any order
    // (guards against webhook delay/failure leaving order stuck in pending)
    const mainOrder =
      completed.find(o => !isSpecial(o)) ||
      allOrders.find(o => !isSpecial(o));
    if (mainOrder) {
      tier = mainOrder.tier;
      bumpFunnel = mainOrder.bump_funnel_copy;
      bumpPrompts = mainOrder.bump_ai_prompts;
    }
  }

  return res.json({
    ok: true,
    firstName: lead.first_name,
    email,
    tier,
    bumpFunnel,
    bumpPrompts,
    dfyVault,
    purchasedVaultItems,
    converted: lead.converted,
  });
};
