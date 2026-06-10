-- ================================================================
-- AI Lead Bundle — Supabase Schema
-- Run this in your Supabase project: SQL Editor → Run
-- ================================================================

-- Orders table (created at checkout, updated by Stripe webhook)
create table if not exists orders (
  id                        uuid        default gen_random_uuid() primary key,
  email                     text        not null,
  first_name                text        not null default '',
  phone                     text        default '',
  stripe_session_id         text        unique,
  stripe_payment_intent_id  text,
  tier                      text        not null default 'basic'
                            check (tier in ('basic', 'silver', 'gold')),
  amount_cents              integer     not null,
  bump_funnel_copy          boolean     default false,
  bump_ai_prompts           boolean     default false,
  status                    text        not null default 'pending'
                            check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- Stripe webhook event log (idempotency)
create table if not exists webhook_events (
  id               uuid        default gen_random_uuid() primary key,
  stripe_event_id  text        unique not null,
  event_type       text        not null,
  payload          jsonb,
  processed        boolean     default false,
  created_at       timestamptz default now()
);

-- Optional leads table (for future opt-in form capture)
create table if not exists leads (
  id          uuid        default gen_random_uuid() primary key,
  email       text        not null,
  first_name  text        default '',
  phone       text        default '',
  converted   boolean     default false,
  created_at  timestamptz default now()
);

-- Indexes for common lookups
create index if not exists orders_stripe_session_idx       on orders (stripe_session_id);
create index if not exists orders_stripe_intent_idx        on orders (stripe_payment_intent_id);
create index if not exists orders_email_idx                on orders (email);
create index if not exists webhook_events_event_id_idx     on webhook_events (stripe_event_id);

-- Enable RLS (service role key bypasses RLS — safe for backend-only access)
alter table orders          enable row level security;
alter table webhook_events  enable row level security;
alter table leads           enable row level security;

-- No public policies needed — backend uses service role key only
-- If you need anon read access to orders (e.g., thank-you page status check):
-- create policy "anon read own order" on orders for select using (true);
