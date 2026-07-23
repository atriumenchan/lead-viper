'use strict';
// One-off script: resend welcome email to specific leads by email address.
// Fetches credentials from Supabase, then calls the live deployed API to send.
// Usage: node scripts/resend-specific.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const crypto = require('crypto');

const LIVE_API_BASE = 'https://leadengine.admexo.com';

const TARGETS = [
  'ashleysoman3@gmail.com',
  'shehroz.raza0344@gmail.com',
  'director@deeperlife.hk',
];

function callApi(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    }).on('error', reject);
  });
}

async function resendForEmail(supabase, emailAddr) {
  console.log(`\n── Processing: ${emailAddr}`);

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, first_name, email, access_password, converted')
    .ilike('email', emailAddr)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) { console.error(`  ERROR fetching lead: ${error.message}`); return; }
  const lead = leads && leads[0];
  if (!lead) { console.error(`  NOT FOUND in leads table`); return; }

  console.log(`  Found: id=${lead.id}, name=${lead.first_name}, converted=${lead.converted}`);

  // Ensure they have a password
  let password = lead.access_password;
  if (!password) {
    password = crypto.randomBytes(4).toString('hex').toUpperCase();
    await supabase.from('leads').update({ access_password: password }).eq('id', lead.id);
    console.log(`  Generated new password: ${password}`);
  } else {
    console.log(`  Password: ${password}`);
  }

  // Ensure converted = true
  if (!lead.converted) {
    await supabase.from('leads').update({ converted: true }).eq('id', lead.id);
    console.log(`  Marked as converted`);
  }

  // Call the live API
  const url = `${LIVE_API_BASE}/api/send-welcome?email=${encodeURIComponent(lead.email)}&proof=${encodeURIComponent(password)}`;
  console.log(`  Calling live API...`);
  try {
    const result = await callApi(url);
    if (result.data?.ok) {
      console.log(`  ✓ Email sent — sentTo: ${result.data.sentTo}, messageId: ${result.data.messageId}`);
    } else {
      console.error(`  ✗ API error (${result.status}):`, JSON.stringify(result.data));
    }
  } catch (err) {
    console.error(`  ✗ Request failed: ${err.message}`);
  }
}

(async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  for (const email of TARGETS) {
    await resendForEmail(supabase, email);
  }
  console.log('\nDone.');
})();
