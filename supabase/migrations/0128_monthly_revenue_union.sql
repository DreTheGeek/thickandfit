-- Her revenue chart would have frozen on June forever, through launch and past it.
--
-- monthly_revenue read contact_transactions ONLY, which is the Lenus migration table: 1,539 rows
-- ending 13 June 2026, and nothing in the application writes to it (verified by grep: clients.ts
-- reads it, system-map.ts describes it, nobody inserts). The Stripe webhook writes `payments`.
--
-- So the two halves never met. Every dollar this app earns from October lands in `payments`, the
-- Business Overview reads contact_transactions, and the chart she opens every morning would keep
-- reporting a business that stopped in June. Nobody would have noticed until she asked why a month
-- of real sales was missing, which is the worst possible day to find out.
--
-- UNION IN THE VIEW, not a second writer. The alternative is having the webhook insert into both
-- tables, which means two definitions of "revenue" that drift the first time one path changes.
-- One view, two sources, one answer.

create or replace view public.monthly_revenue
with (security_invoker = true) as
with sources as (
  -- Migrated Lenus history. gross and coach are distinct because Lenus took a cut; keep both.
  select
    company_id,
    occurred_at::timestamptz as at,
    gross_cents,
    coach_cents
  from public.contact_transactions
  where occurred_at is not null

  union all

  -- This app's own Stripe revenue. paid_at, not created_at: a payment row is created when the
  -- invoice is raised and that is not when the money arrived, so created_at would book revenue in
  -- the wrong month at every month boundary.
  --
  -- Refunds are subtracted rather than ignored. A refunded charge is not revenue, and a chart that
  -- counts it is the kind of number that survives right up until someone reconciles against Stripe.
  --
  -- coach_cents equals gross here: this is a single-account integration with no platform fee taken
  -- out (there is no Connect in this codebase), so her take IS the gross. If a fee is ever
  -- introduced, this is the line that changes.
  select
    company_id,
    paid_at as at,
    (amount_cents - coalesce(amount_refunded_cents, 0))::bigint,
    (amount_cents - coalesce(amount_refunded_cents, 0))::bigint
  from public.payments
  where paid_at is not null
    -- Only money that actually settled. `payments` also carries failed and pending rows, and a
    -- failed charge appearing in the revenue trend is a lie with a dollar sign on it.
    and status in ('succeeded', 'paid')
)
select
  company_id,
  date_trunc('month', at)::date as month,
  sum(gross_cents)::bigint as gross_cents,
  sum(coach_cents)::bigint as coach_cents,
  count(*)::integer as txn_count
from sources
group by company_id, date_trunc('month', at);

comment on view public.monthly_revenue is
  'Revenue by month across BOTH sources: migrated Lenus transactions and this app''s Stripe payments. Union lives here rather than in a second writer so there is one definition of revenue. security_invoker so RLS on the underlying tables still applies.';
