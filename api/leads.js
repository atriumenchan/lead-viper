'use strict';
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL              = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { email, firstName, first_name, phone, mobile } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { data, error } = await supabase.from('leads').insert({
    email, first_name: firstName || first_name || '', last_name: '', mobile: phone || mobile || '', country_code: '+1', profession: 'Not specified', converted: false,
  }).select('id').single();

  if (error) {
    console.error('[leads]', error.message);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  return res.json({ success: true, lead_id: data.id });
};
