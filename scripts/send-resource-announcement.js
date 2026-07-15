'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../api/_email');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SEND = process.argv.includes('--send');
const SUBJECT = 'Two new resources are now available inside your AI Lead Engine';
const DASHBOARD_URL = `${(process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '')}/access`;

function excluded(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return true;
  const [local, domain] = value.split('@');
  if (domain === 'admexo.com' || domain === 'example.com') return true;
  return /^(test|testuser|user|demo|qa|sample)\d*$/.test(local);
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildAnnouncement(firstName) {
  const name = firstName || 'there';
  const text = `Hi ${name},

We’ve added two valuable resources to your AI Lead Engine dashboard:

1. Personalized 21 Leads in 21 Days Planner

Create a practical action plan based on your business, niche, offer, and current lead-generation goals.

2. Landing Page and Funnel Template Library

You now have access to landing page, sales page, funnel, Elementor, and WordPress templates to help you build faster and avoid starting every page from a blank canvas.

Log in here to access everything:
${DASHBOARD_URL}

These resources are included with your existing access. No additional payment is required.

To your success,
Team ADMEXO
AI & Performance Marketing Experts`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:32px 12px;background:#f5f5f7"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ececf0"><tr><td style="background:#661fff;padding:22px 32px;font:700 18px Arial;color:#fff">⚡ AI Lead Engine</td></tr><tr><td style="padding:32px;font:15px/1.65 Arial;color:#222"><h1 style="font-size:22px;color:#1a1033">Two new resources are ready for you</h1><p>Hi ${escapeHtml(name)},</p><p>We’ve added two valuable resources to your AI Lead Engine dashboard:</p><h2 style="font-size:17px;color:#1a1033">1. Personalized 21 Leads in 21 Days Planner</h2><p>Create a practical action plan based on your business, niche, offer, and current lead-generation goals.</p><h2 style="font-size:17px;color:#1a1033">2. Landing Page and Funnel Template Library</h2><p>You now have access to landing page, sales page, funnel, Elementor, and WordPress templates to help you build faster and avoid starting every page from a blank canvas.</p><p style="text-align:center;margin:28px 0"><a href="${DASHBOARD_URL}" style="display:inline-block;background:#661fff;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:8px">Open My Dashboard →</a></p><p>These resources are included with your existing access. No additional payment is required.</p><p>To your success,<br><strong>Team ADMEXO</strong><br>AI &amp; Performance Marketing Experts</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: SUBJECT, html, text };
}

async function main() {
  const { data: orders, error: orderError } = await supabase.from('orders').select('lead_id').eq('status', 'completed').not('lead_id', 'is', null);
  if (orderError) throw orderError;
  const leadIds = [...new Set((orders || []).map(order => order.lead_id))];
  if (!leadIds.length) return console.log('No completed purchasers found.');
  const { data: leads, error: leadError } = await supabase.from('leads').select('email, first_name').in('id', leadIds);
  if (leadError) throw leadError;
  const recipients = [...new Map((leads || []).filter(lead => !excluded(lead.email)).map(lead => [lead.email.trim().toLowerCase(), lead])).values()];
  console.log(`Eligible recipients: ${recipients.length}`);
  recipients.forEach(lead => console.log(`- ${lead.email}`));
  if (!SEND) return console.log('Dry run only. Add --send after reviewing the recipient list to send.');
  let sent = 0;
  for (const lead of recipients) {
    await sendEmail({ to: lead.email.trim().toLowerCase(), ...buildAnnouncement(lead.first_name) });
    sent++;
    console.log(`Sent ${sent}/${recipients.length}: ${lead.email}`);
  }
  console.log(`Completed: ${sent} announcement emails sent.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
