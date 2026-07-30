-- 0095: one authoritative entitlement table.
--
-- Why: App Store submission checklist marks this a BLOCKER, and it is right. Access is currently
-- derived from TWO places, and neither can represent an Apple purchase:
--   * subscriptions            (Stripe-shaped: stripe_subscription_id, card_brand, period_end)
--   * profiles.comp_access_until (a bare timestamp for comped members)
-- Adding Apple IAP would have made it three, with the client guessing which one wins. Apple also
-- requires that the client never trust a payment provider directly for entitlement state.
--
-- Design:
--   * This table is the authoritative READ model. isEntitled() queries ONLY here.
--   * Every provider PROJECTS into it: Stripe webhook, comp grants, Apple ASSN v2 (when IAP ships),
--     GHL. `source` records which one, so a support question ("why does she have access?") has a
--     single answer with the raw payload attached.
--   * `subscriptions` stays as the Stripe-specific billing DETAIL table (card brand/last4, period
--     end, cancel_at_period_end) that the billing UI renders. It is no longer an access oracle.
--     profiles.comp_access_until likewise stays written for the 9 admin/coach surfaces that read it.
--     That keeps this migration additive: no behavior change for existing readers.
--   * Idempotency is structural, not procedural. Duplicate webhook delivery is normal, so
--     (company_id, source, external_txn_id) is UNIQUE and every writer upserts on it.
--   * raw_payload keeps the provider event verbatim for dispute evidence and replay.
--
-- Money: none stored here on purpose. Price belongs to the billing record, not the access grant;
-- duplicating it would create two truths about what someone paid.

create table if not exists public.entitlements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  -- What was granted. 'self_guided' today; Apple product ids and future tiers land here too.
  product_key      text not null default 'self_guided',
  -- Which system granted it. The checklist's required vocabulary.
  source           text not null check (source in ('apple', 'stripe', 'ghl', 'manual')),
  -- Provider-normalized lifecycle. 'active' and 'trialing' are the only states that grant access
  -- (see isActiveEntitlementStatus in src/lib/billing/entitlement.ts, which must stay in sync).
  status           text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired', 'revoked')),
  started_at       timestamptz not null default now(),
  -- NULL means open-ended (a manual grant with no end date). A set value is enforced at read time.
  expires_at       timestamptz,
  -- The provider's own id: stripe subscription id, Apple originalTransactionId, or a synthetic key
  -- for manual grants. Carries the idempotency guarantee below.
  external_txn_id  text not null,
  raw_payload      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- THE idempotency guard. Stripe and Apple both redeliver; without this a retry double-grants.
create unique index if not exists idx_entitlements_source_txn
  on public.entitlements (company_id, source, external_txn_id);

-- The hot read: "is this member entitled right now?"
create index if not exists idx_entitlements_lookup
  on public.entitlements (company_id, profile_id, status);

alter table public.entitlements enable row level security;

-- A member may read their OWN entitlements (the billing screen explains their access), and nothing
-- else. There is no member INSERT/UPDATE policy at all: granting access is never a client action.
-- Every write flows through the service client in billing code, which validates the provider event
-- server-side first. This is the Apple requirement ("never trust the client for entitlement state")
-- expressed as a database constraint rather than a convention.
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.company_id = entitlements.company_id
        and p.role in ('coach', 'assistant_coach', 'operator')
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill. Runs before isEntitled() switches over, so no live member loses
-- access on deploy. Both statements are idempotent via the unique index.
-- ---------------------------------------------------------------------------

-- 1) Existing Stripe subscriptions. Status is mapped to this table's vocabulary; anything Stripe
--    reports that we do not model becomes 'expired' (deny) rather than being assumed active.
insert into public.entitlements
  (company_id, profile_id, product_key, source, status, started_at, expires_at, external_txn_id, raw_payload)
select
  s.company_id,
  s.profile_id,
  'self_guided',
  'stripe',
  case s.status
    when 'active' then 'active'
    when 'trialing' then 'trialing'
    when 'past_due' then 'past_due'
    when 'canceled' then 'canceled'
    when 'unpaid' then 'expired'
    when 'incomplete' then 'expired'
    when 'incomplete_expired' then 'expired'
    else 'expired'
  end,
  coalesce(s.created_at, now()),
  s.current_period_end,
  s.stripe_subscription_id,
  jsonb_build_object('backfilled_from', 'subscriptions', 'stripe_status', s.status)
from public.subscriptions s
where s.stripe_subscription_id is not null
on conflict (company_id, source, external_txn_id) do nothing;

-- 2) Comped members with a live window. external_txn_id is synthesized from the profile so a
--    re-run cannot create a second row for the same person.
insert into public.entitlements
  (company_id, profile_id, product_key, source, status, started_at, expires_at, external_txn_id, raw_payload)
select
  p.company_id,
  p.id,
  'self_guided',
  'manual',
  'active',
  now(),
  p.comp_access_until,
  'comp:' || p.id::text,
  jsonb_build_object('backfilled_from', 'profiles.comp_access_until')
from public.profiles p
where p.comp_access_until is not null
  and p.comp_access_until > now()
  and p.company_id is not null
on conflict (company_id, source, external_txn_id) do nothing;
