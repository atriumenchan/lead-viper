// Abandoned-checkout reminder drip.
// Triggered daily by a Vercel cron (see vercel.json).
//
// 3-stage sequence for unpaid leads (stops the moment they convert):
//   Stage 1 -> ~1 day after signup
//   Stage 2 -> ~3 days after signup
//   Stage 3 -> ~6 days after signup
//
// Progress is tracked with two columns on `leads`:
//   reminders_sent   integer  default 0
//   last_reminder_at timestamptz
// Run scripts/migrations/2026-reminders.sql once to add them.
//
// Manual run / test: GET /api/remind   (optionally ?dry=1 to preview without sending)
// If CRON_SECRET is set, requests must send Authorization: Bearer <CRON_SECRET>.

const { createClient } = require('@supabase/supabase-js');
const { buildReminderEmail, sendEmail } = require('./_email');

const DAY = 24 * 60 * 60 * 1000;
// reminders_sent value -> minimum age (days) before that stage fires.
const STAGE_AFTER_DAYS = { 0: 1, 1: 3, 2: 6 };
const MAX_REMINDERS = 3;

module.exports = async function handler(req, res) {
  // Optional security: protect the endpoint if CRON_SECRET is configured.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers['authorization'] || '';
    const provided = auth.replace(/^Bearer\s+/i, '') || (req.query && req.query.secret);
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const dry = req.query && (req.query.dry === '1' || req.query.dry === 'true');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const SITE_URL = (process.env.SITE_URL || 'https://leadengine.admexo.com').replace(/\/$/, '');
  const checkoutUrl = `${SITE_URL}/checkout`;

  // Pull unpaid leads that haven't finished the drip yet, old enough for stage 1.
  const eligibleBefore = new Date(Date.now() - STAGE_AFTER_DAYS[0] * DAY).toISOString();
  let leads, fetchError;
  try {
    const result = await supabase.from('leads')
      .select('id, email, first_name, created_at, reminders_sent, last_reminder_at')
      .eq('converted', false)
      .lt('reminders_sent', MAX_REMINDERS)
      .lte('created_at', eligibleBefore)
      .not('email', 'is', null)
      .order('created_at', { ascending: true })
      .limit(200);
    leads = result.data;
    fetchError = result.error;
  } catch (e) {
    fetchError = e;
  }

  if (fetchError) {
    const msg = fetchError.message || String(fetchError);
    if (/reminders_sent|last_reminder_at|column/i.test(msg)) {
      return res.status(500).json({
        error: 'Migration required',
        detail: 'Add reminders_sent and last_reminder_at columns to the leads table. See scripts/migrations/2026-reminders.sql',
      });
    }
    return res.status(500).json({ error: msg });
  }

  if (!leads || leads.length === 0) return res.json({ sent: 0, checked: 0 });

  const now = Date.now();
  let sent = 0;
  const previews = [];

  for (const lead of leads) {
    const alreadySent = lead.reminders_sent || 0;
    const ageDays = (now - new Date(lead.created_at).getTime()) / DAY;
    const requiredAge = STAGE_AFTER_DAYS[alreadySent];

    // Not old enough for the next stage yet.
    if (requiredAge == null || ageDays < requiredAge) continue;
    // Safety: never send two reminders within ~20h of each other.
    if (lead.last_reminder_at && now - new Date(lead.last_reminder_at).getTime() < 20 * 60 * 60 * 1000) continue;

    const stage = alreadySent + 1; // 1, 2, or 3
    const { subject, html, text } = buildReminderEmail({
      firstName: lead.first_name,
      checkoutUrl,
      stage,
    });

    if (dry) { previews.push({ email: lead.email, stage, subject }); continue; }

    try {
      await sendEmail({ to: lead.email, subject, html, text });
      await supabase.from('leads')
        .update({ reminders_sent: stage, last_reminder_at: new Date().toISOString() })
        .eq('id', lead.id);
      sent++;
    } catch (err) {
      console.error('[remind] failed for', lead.email, err.message);
    }
  }

  if (dry) return res.json({ dryRun: true, wouldSend: previews.length, previews });
  return res.json({ sent, checked: leads.length });
};
