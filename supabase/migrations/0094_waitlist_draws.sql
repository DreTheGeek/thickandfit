-- 0094: verifiable sweepstakes draws.
--
-- Why this table exists at all: entries are earned partly by REFERRAL, which makes the giveaway a
-- promotion with real legal exposure (kb-funnels/references/legality.md). If a loser asks "how do I
-- know this was fair," the answer has to be arithmetic, not trust. So a draw stores everything
-- needed to recompute its own winner:
--
--   seed          - crypto-random at draw time (unpredictable BEFORE, fixed AFTER)
--   pool_hash     - sha256 of the exact entrant pool, so an altered pool is detectable
--   pool_snapshot - the pool itself (lead id + entry weight), frozen at draw time
--   winner_lead_id
--
-- Anyone holding (pool_snapshot, seed) can rerun the same deterministic PRNG and land on the same
-- winner. That is what makes the draw publishable.
--
-- Three draws are planned (2026-07-23 call): early-bird ~Aug 18, main at doors-open Sept 27, and a
-- founding-members-only final when the 5-day window closes.

create table if not exists public.waitlist_draws (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  -- 'early_bird' | 'main' | 'founding_final' | 'bonus' (bonus = an unplanned extra drawing)
  kind            text not null check (kind in ('early_bird', 'main', 'founding_final', 'bonus')),
  label           text not null,
  -- Reproducibility triple.
  seed            text not null,
  pool_hash       text not null,
  pool_snapshot   jsonb not null,
  -- Rollup of the pool, denormalized so the board renders without parsing the snapshot.
  entrant_count   integer not null check (entrant_count >= 0),
  total_entries   integer not null check (total_entries >= 0),
  -- Which filters produced this pool (confirmed-only, founding-only, excluded staff/test, etc).
  filters         jsonb not null default '{}'::jsonb,
  -- Winner. Nullable so a pool can be snapshotted and drawn in two steps if ever needed.
  winner_lead_id  uuid references public.waitlist_leads(id) on delete set null,
  winner_email    text,
  winner_name     text,
  drawn_by        uuid references public.profiles(id) on delete set null,
  drawn_at        timestamptz not null default now(),
  -- Set when an operator voids a draw (e.g. winner ineligible). Voided draws stay on the record:
  -- deleting a draw would defeat the entire point of an auditable trail.
  voided_at       timestamptz,
  void_reason     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_waitlist_draws_company
  on public.waitlist_draws (company_id, drawn_at desc);

alter table public.waitlist_draws enable row level security;

-- Operator/coach read only. Every write goes through the service client in waitlist-draw-actions.ts,
-- which re-checks requireOperator. No member-facing policy: winners are announced by Stephanie on
-- her own channels, not read out of the DB by the client.
drop policy if exists waitlist_draws_read on public.waitlist_draws;
create policy waitlist_draws_read on public.waitlist_draws for select
  using (company_id = public.current_company_id() and public.is_coach());

comment on table public.waitlist_draws
  is 'Verifiable sweepstakes draws. seed + pool_snapshot + pool_hash make each winner independently recomputable, which is the defense if fairness is ever challenged.';
comment on column public.waitlist_draws.pool_hash
  is 'sha256 of the canonicalized pool (lead_id:weight pairs, sorted). Detects any post-hoc pool edit.';
comment on column public.waitlist_draws.voided_at
  is 'Voided draws are retained, never deleted - the audit trail is the product here.';
