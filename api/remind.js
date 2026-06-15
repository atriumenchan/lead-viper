'use strict';
const { createClient } = require('@supabase/supabase-js');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

module.exports = async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const SITE_URL = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');
  const ses = new SESClient({
    region: process.env.AWS_SES_REGION || 'us-east-2',
    credentials: { accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY },
  });

  const oneHourAgo  = new Date(Date.now() - 65 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();

  const { data: leads } = await supabase.from('leads')
    .select('id, email, first_name')
    .eq('converted', false)
    .gte('created_at', twoHoursAgo)
    .lte('created_at', oneHourAgo)
    .not('email', 'is', null);

  if (!leads || leads.length === 0) return res.json({ sent: 0 });

  let sent = 0;
  for (const lead of leads) {
    try {
      const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0a0a1f;border-radius:12px;overflow:hidden;max-width:600px">
  <tr><td style="padding:32px 40px;text-align:center">
    <h1 style="color:#d97706;font-size:22px;margin:0 0 12px;font-family:Arial,sans-serif">⏰ You left something behind...</h1>
    <p style="color:#d1d5db;font-size:15px;margin:0 0 20px">Hi ${lead.first_name || 'there'}, you were so close to getting your AI Lead Engine! Your spot is still waiting.</p>
    <table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
      <a href="${SITE_URL}/checkout" style="display:inline-block;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;font-weight:bold;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none">Complete My Purchase →</a>
    </td></tr></table>
    <p style="color:#6b7280;font-size:12px;margin:20px 0 0">Questions? <a href="mailto:support@admexo.com" style="color:#d97706">support@admexo.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

      await ses.send(new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL || 'noreply@admexo.com',
        Destination: { ToAddresses: [lead.email] },
        Message: {
          Subject: { Data: '⏰ You left your AI Lead Engine behind...' },
          Body: { Html: { Data: html }, Text: { Data: `Hi ${lead.first_name || 'there'}, complete your purchase: ${SITE_URL}/checkout` } },
        },
      }));
      sent++;
    } catch (err) {
      console.error('[remind] failed for', lead.email, err.message);
    }
  }

  return res.json({ sent, checked: leads.length });
};
