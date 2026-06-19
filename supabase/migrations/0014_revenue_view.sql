-- Monthly revenue rollup for the Business Overview. Aggregating in the DB avoids the
-- PostgREST row cap (the transactions table exceeds 1000 rows). security_invoker so the
-- view respects the querying role's RLS on contact_transactions.
create or replace view public.monthly_revenue
with (security_invoker = true) as
select
  company_id,
  date_trunc('month', occurred_at)::date as month,
  sum(gross_cents)::bigint as gross_cents,
  sum(coach_cents)::bigint as coach_cents,
  count(*)::int as txn_count
from public.contact_transactions
where occurred_at is not null
group by company_id, date_trunc('month', occurred_at);
