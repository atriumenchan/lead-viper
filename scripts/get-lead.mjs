// Read-only helper: fetch a lead's details + access password by email.
// Usage: node scripts/get-lead.mjs <email>
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) { console.error('Pass an email: node scripts/get-lead.mjs you@example.com'); process.exit(1); }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from('leads')
  .select('id, first_name, last_name, email, access_password, converted, created_at')
  .ilike('email', email)
  .order('created_at', { ascending: false });

if (error) { console.error('Error:', error.message); process.exit(1); }
console.log(JSON.stringify(data, null, 2));
