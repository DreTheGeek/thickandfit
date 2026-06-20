-- 0025 PHASE 2 — Stripe billing (honest billing, the anti-Noom/BetterMe differentiator).
-- subscriptions + payments mirror Stripe state; webhook_events gives us idempotency so a
-- replayed Stripe event is a no-op; cancellation_reasons captures optional churn feedback.
-- Money is BIGINT cents (_cents). RLS on every table: a subscriber sees their own row,
-- a coach sees everything in the company. Webhook writes go through the service client.

-- ---------------------------------------------------------------------------------------------
-- subscriptions: one row per Stripe subscription, kept in sync by the webhook.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'incomplete',     -- trialing|active|past_due|canceled|incomplete|unpaid|paused
  price_cents bigint not null default 0,
  currency text not null default 'usd',
  card_brand text,
  card_last4 text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_profile on public.subscriptions (profile_id);
create index if not exists idx_subscriptions_company on public.subscriptions (company_id);
create unique index if not exists idx_subscriptions_customer on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
-- All mutations are service-role (the webhook + checkout). No user-facing write policy:
-- a subscriber cannot edit their billing row directly; cancel goes through Stripe via a route.

-- ---------------------------------------------------------------------------------------------
-- payments: one row per invoice/charge outcome, for the billing history + chargeback evidence.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid references public.profiles(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_invoice_id text,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_cents bigint not null default 0,
  amount_refunded_cents bigint not null default 0,
  currency text not null default 'usd',
  status text not null default 'pending',         -- succeeded|failed|refunded|partially_refunded|pending
  description text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_payments_invoice on public.payments (stripe_invoice_id)
  where stripe_invoice_id is not null;
create index if not exists idx_payments_profile on public.payments (profile_id, created_at);
create index if not exists idx_payments_company on public.payments (company_id, created_at);

alter table public.payments enable row level security;
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
-- Writes are service-role only (webhook).

-- ---------------------------------------------------------------------------------------------
-- webhook_events: Stripe event idempotency ledger. UNIQUE stripe_event_id = process-once.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  error text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_events_type on public.webhook_events (event_type);

alter table public.webhook_events enable row level security;
drop policy if exists webhook_events_coach_read on public.webhook_events;
create policy webhook_events_coach_read on public.webhook_events for select
  using (public.is_coach());
-- Writes are service-role only (webhook). System table, no tenant column (Stripe events are global).

-- ---------------------------------------------------------------------------------------------
-- cancellation_reasons: optional churn feedback at cancel time. No dark patterns: it is optional.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.cancellation_reasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  reason_code text,                               -- too_expensive|not_using|missing_feature|other
  reason_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cancellation_reasons_profile on public.cancellation_reasons (profile_id);

alter table public.cancellation_reasons enable row level security;
drop policy if exists cancellation_reasons_read on public.cancellation_reasons;
create policy cancellation_reasons_read on public.cancellation_reasons for select
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
drop policy if exists cancellation_reasons_insert on public.cancellation_reasons;
create policy cancellation_reasons_insert on public.cancellation_reasons for insert
  with check (profile_id = auth.uid() and company_id = public.current_company_id());
