'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const USERS = [
  {
    label       : 'Full access (Gold + both bumps)',
    email       : 'test-gold@admexo.com',
    password    : 'GOLD-TEST-2026',
    first_name  : 'Gold Tester',
    tier        : 'gold',
    amount_cents: 4400,        // $15 base + $12 funnel + $17 prompts
    bumpFunnel  : true,
    bumpPrompts : true,
  },
  {
    label       : 'Basic access ($3 tier, no bumps)',
    email       : 'test-basic@admexo.com',
    password    : 'BASIC-TEST-2026',
    first_name  : 'Basic Tester',
    tier        : 'basic',
    amount_cents: 300,         // $3
    bumpFunnel  : false,
    bumpPrompts : false,
  },
];

async function seed() {
  for (const u of USERS) {
    console.log(`\n── ${u.label} ──`);

    // Remove any existing test record for this email
    await supabase.from('orders').delete().in(
      'lead_id',
      (await supabase.from('leads').select('id').eq('email', u.email)).data?.map(r => r.id) || []
    );
    await supabase.from('leads').delete().eq('email', u.email);

    // Insert lead
    const { data: lead, error: le } = await supabase.from('leads').insert({
      first_name   : u.first_name,
      last_name    : 'Test',
      email        : u.email,
      mobile       : '+10000000000',
      country_code : '+1',
      profession   : 'Tester',
      converted    : true,
      access_password: u.password,
    }).select('id').single();

    if (le || !lead) { console.error('  ✗ lead insert failed:', le?.message); continue; }
    console.log(`  ✓ lead inserted  id=${lead.id}`);

    // Insert completed order
    const { error: oe } = await supabase.from('orders').insert({
      lead_id           : lead.id,
      stripe_session_id : `test_${u.tier}_${Date.now()}`,
      tier              : u.tier,
      amount_cents      : u.amount_cents,
      bump_funnel_copy  : u.bumpFunnel,
      bump_ai_prompts   : u.bumpPrompts,
      status            : 'completed',
    });

    if (oe) { console.error('  ✗ order insert failed:', oe?.message); continue; }
    console.log(`  ✓ order inserted  tier=${u.tier}  bumps: funnel=${u.bumpFunnel} prompts=${u.bumpPrompts}`);
    console.log(`  📧 email   : ${u.email}`);
    console.log(`  🔑 password: ${u.password}`);
  }

  console.log('\n✅ Done. Login at /access');
}

seed().catch(console.error);
