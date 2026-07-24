-- 0090: extend the waitlist for the Libra Season funnel (2026-07-23 call, Aug 4 → Sept 27 doors).
--
-- Adds referral codes, entry ledger, quiz responses, and the suppression/confirmation columns per
-- kb-funnels/references/referral-mechanics.md + waitlist-page.md + legality.md.
--
-- Entry math (locked): 1 for signup, +2 for quiz, +3 per confirmed referral (cap 20 total referrals).
-- Confirmations gate DELIVERABILITY (drip suppression for unconfirmed), never the thank-you page —
-- doctrine 1 of the skill is "the thank-you page is the product pre-launch," never verify-then-show.
-- Buyer suppression via converted_at + unsubscribed_at, filtered by every scheduled AND every
-- triggered send (post-conversion suppression is the highest-severity failure in the whole funnel).

------------------------------------------------------------------------------
-- 1. Extend waitlist_leads
------------------------------------------------------------------------------

alter table public.waitlist_leads
  add column if not exists first_name           text,
  add column if not exists last_name            text,
  add column if not exists phone                text,
  add column if not exists instagram_handle     text,
  add column if not exists referral_code        text,
  add column if not exists referred_by_code     text,
  add column if not exists entry_count          integer not null default 1,
  add column if not exists confirmed_at         timestamptz,           -- double opt-in stamp
  add column if not exists quiz_completed_at    timestamptz,
  add column if not exists converted_at         timestamptz,           -- flipped by the Stripe webhook
  add column if not exists unsubscribed_at      timestamptz;

-- Referral code: 12 hex chars from gen_random_bytes(6) — 48 bits, negligible collision at 5k leads.
-- Default expression is applied per-row on INSERT; existing rows are backfilled below (a single
-- expression applied to ALL existing rows would give them the same value and blow the unique index).
update public.waitlist_leads
   set referral_code = lower(encode(gen_random_bytes(6), 'hex'))
 where referral_code is null;

alter table public.waitlist_leads
  alter column referral_code set default lower(encode(gen_random_bytes(6), 'hex')),
  alter column referral_code set not null;

-- Unique referral_code per tenant. A collision at insert time is a retry-on-conflict for the caller.
create unique index if not exists idx_waitlist_referral_code
  on public.waitlist_leads(company_id, referral_code);

-- Fast lookups the drip + suppression + reporting rely on.
create index if not exists idx_waitlist_referred_by
  on public.waitlist_leads(company_id, referred_by_code)
  where referred_by_code is not null;

create index if not exists idx_waitlist_active
  on public.waitlist_leads(company_id)
  where converted_at is null and unsubscribed_at is null;

------------------------------------------------------------------------------
-- 2. Entry ledger — every entry-earning event, idempotent, verifiable
------------------------------------------------------------------------------

create table if not exists public.waitlist_entry_events (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  lead_id          uuid not null references public.waitlist_leads(id) on delete cascade,
  kind             text not null check (kind in ('signup','quiz','referral','follow_ig','follow_tt','follow_yt','post_public')),
  points           integer not null check (points > 0 and points <= 10),
  -- For 'referral' events, the referred lead whose signup triggered the credit. Prevents
  -- double-credit if the same friend signs up twice with different casings of the same email.
  source_lead_id   uuid references public.waitlist_leads(id) on delete set null,
  -- Idempotency: the app writes with a stable key so a retried request never double-credits.
  -- For a referral: idempotency_key = 'ref:' || source_lead_id  (one credit per unique friend).
  -- For quiz:      idempotency_key = 'quiz:' || lead_id         (one credit per lead).
  -- For signup:    idempotency_key = 'signup:' || lead_id.
  -- For social:    idempotency_key = 'follow_<plat>:' || lead_id.
  idempotency_key  text not null,
  created_at       timestamptz not null default now()
);

-- Idempotency + no-double-credit: same (lead, kind, key) can only exist once.
create unique index if not exists idx_waitlist_events_dedupe
  on public.waitlist_entry_events(company_id, lead_id, idempotency_key);

create index if not exists idx_waitlist_events_lead
  on public.waitlist_entry_events(lead_id, created_at desc);

------------------------------------------------------------------------------
-- 3. Quiz responses — one per lead, feeds tagging + tier-candidate flag
------------------------------------------------------------------------------

create table if not exists public.waitlist_quiz_responses (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  lead_id              uuid not null unique references public.waitlist_leads(id) on delete cascade,
  -- Multi-select from the quiz: 'lose_fat' | 'build_muscle' | 'recomp' | 'strength' | 'feel_better' | 'nutrition'.
  goal                 text[] not null default '{}',
  home_or_gym          text check (home_or_gym in ('home','gym','both')),
  days_per_week        integer check (days_per_week between 1 and 7),
  -- How they eat: 'macros' | 'meal_plan' | 'intuitive' | 'not_sure'.
  how_they_eat         text,
  preferred_language   text not null default 'en' check (preferred_language in ('en','es')),
  -- Populated by the app after mapping goals + budget signals; enables mid/high-ticket private
  -- application flow post-launch. NOT public UI at launch.
  tier_candidate       text check (tier_candidate in ('self','team','steph')),
  created_at           timestamptz not null default now()
);

------------------------------------------------------------------------------
-- 4. RLS — tenant-scoped read for coach/operator; all writes via service client
------------------------------------------------------------------------------

-- waitlist_leads already has RLS on + a select policy (0003); the new columns inherit that.

alter table public.waitlist_entry_events enable row level security;
alter table public.waitlist_quiz_responses enable row level security;

create policy waitlist_events_tenant on public.waitlist_entry_events
  for select using (company_id = public.current_company_id());

create policy waitlist_quiz_tenant on public.waitlist_quiz_responses
  for select using (company_id = public.current_company_id());

------------------------------------------------------------------------------
-- 5. Backfill: give existing leads a signup event so the ledger reconciles to entry_count
------------------------------------------------------------------------------

insert into public.waitlist_entry_events (company_id, lead_id, kind, points, idempotency_key, created_at)
select l.company_id, l.id, 'signup', 1, 'signup:' || l.id::text, l.created_at
  from public.waitlist_leads l
 where not exists (
   select 1 from public.waitlist_entry_events e
    where e.lead_id = l.id and e.kind = 'signup'
 );

------------------------------------------------------------------------------
-- 6. Comments for the coach who reads the schema in six months
------------------------------------------------------------------------------

comment on column public.waitlist_leads.referral_code
  is 'Per-tenant unique 12-char hex code; forms /join?r=<code>. Never regenerated — a stale link must still resolve.';
comment on column public.waitlist_leads.entry_count
  is 'Denormalized SUM(waitlist_entry_events.points) for this lead. Kept live by the app; the ledger is truth.';
comment on column public.waitlist_leads.converted_at
  is 'Flipped by Stripe checkout.session.completed. Suppresses ALL further drip sends — the highest-severity failure in the funnel is a buyer receiving "doors close" copy.';
comment on column public.waitlist_leads.confirmed_at
  is 'Double opt-in confirmation stamp. Unconfirmed leads still get the thank-you page (per kb-funnels doctrine); they are only suppressed from bulk sends until confirmed.';
comment on table  public.waitlist_entry_events
  is 'Append-only ledger of entry-earning events. Idempotent via unique(lead_id, idempotency_key). Truth for the leaderboard + verifiable draw.';
comment on table  public.waitlist_quiz_responses
  is 'Post-signup profile quiz. Awards +2 entries once (quiz_completed_at on the lead), tags language + tier_candidate for post-launch private-application flow.';
