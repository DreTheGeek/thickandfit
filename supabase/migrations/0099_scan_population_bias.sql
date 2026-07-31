-- K4: materialized population portion bias.
--
-- Why a table and not a live query: the aggregate reads every corrected photo-scan inference in the
-- tenant and rolls it up. That is fine nightly and absurd on the hot path of a photo scan, which
-- already carries a vision call plus food resolution. So it is computed on a schedule and READ as a
-- single indexed lookup during a scan.
--
-- ANONYMOUS BY CONSTRUCTION. There is deliberately no profile_id column and no per-member row. The
-- member count is an integer, not a list. Nothing here can answer "who corrected this", which is the
-- correct shape for a signal that gets injected into every other member's prompt.

create table if not exists public.scan_population_bias (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  -- Normalized food name (lowercased, whitespace-collapsed) as produced by normalizeFoodKey.
  food_key      text not null,
  -- Median corrected/predicted grams. > 1 means the engine under-estimates this food.
  ratio         numeric(5,2) not null,
  -- Evidence behind the ratio. Both are floors enforced in code before a row is written; they are
  -- stored so the admin surface can show WHY a prior exists and a human can judge it.
  sample_count  integer not null,
  member_count  integer not null,
  computed_at   timestamptz not null default now(),
  constraint scan_population_bias_ratio_ck check (ratio > 0 and ratio <= 10),
  constraint scan_population_bias_samples_ck check (sample_count > 0 and member_count > 0)
);

-- One row per food per tenant; the refresh upserts on it.
create unique index if not exists scan_population_bias_food_uidx
  on public.scan_population_bias (company_id, food_key);

-- The read on the scan hot path: strongest deviation first.
create index if not exists scan_population_bias_read_idx
  on public.scan_population_bias (company_id, computed_at desc);

alter table public.scan_population_bias enable row level security;

-- Operator-only, and READ-only even for them. This table is written exclusively by the refresh job
-- running as the service role: a hand-edited prior would silently change every member's scan with no
-- evidence behind it and no audit trail, which is precisely what the sample/member floors exist to
-- prevent. There is intentionally no member-facing policy at all.
drop policy if exists scan_population_bias_operator_read on public.scan_population_bias;
create policy scan_population_bias_operator_read on public.scan_population_bias for select
  using (company_id = public.current_company_id() and public.profile_role() = 'operator');

comment on table public.scan_population_bias is
  'K4 population portion bias, refreshed on a schedule from corrected photo-scan inferences. Anonymous aggregate: no profile ids, no per-member rows. Read into the scan prompt as a prior; never a target weight.';
