-- Abandoned-checkout reminder drip: tracking columns on `leads`.
-- Run once in the Supabase SQL Editor.

alter table leads add column if not exists reminders_sent   integer     not null default 0;
alter table leads add column if not exists last_reminder_at  timestamptz;

-- Optional: helps the daily cron query stay fast as the table grows.
create index if not exists idx_leads_reminder_drip
  on leads (converted, reminders_sent, created_at);
