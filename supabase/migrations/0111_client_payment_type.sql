-- Tell monthly clients apart from paid-in-full, which Stephanie has asked for directly.
--
-- WHY IT WAS NOT ALREADY POSSIBLE. `client_subscriptions` is the table the Clients screen reads, and
-- 189 of its 256 rows have no billing information at all: the Lenus export populated it for only 67
-- clients. Asking that table who pays monthly returns "no idea" for three quarters of her business.
--
-- The answer was sitting in the raw import the whole time. `lenus.transactions` holds 1,539 real
-- charges across 449 customers, $297,716 gross, from March 2024 to June 2026, and 226 of her client
-- contacts join to it on lenus_id. Charge COUNT and recency answer the question directly, and they
-- are facts rather than an inferred flag.
--
-- Classification, and each boundary is a judgement worth stating:
--   One payment           exactly 1 charge. A single purchase, usually a challenge or a small offer.
--   Instalments, finished 2 to 11 charges, none in the last 60 days. She paid over time and stopped.
--   Monthly, active       2 to 11 charges with one in the last 60 days. Still paying now.
--   Monthly, long-term    12 or more charges. A year or more of continuous payments.
--
-- 60 days rather than 30, because a monthly client who is a few days late is still a monthly client
-- and should not flip category over a billing hiccup.

alter table public.contacts
  add column if not exists payment_type     text,
  add column if not exists total_paid_cents bigint,
  add column if not exists charge_count     int,
  add column if not exists last_charge_on   date;

comment on column public.contacts.payment_type is
  'Derived from lenus.transactions charge count and recency, because client_subscriptions has no billing data for 189 of 256 clients. Recompute with public.refresh_payment_types().';

create index if not exists idx_contacts_payment_type
  on public.contacts (company_id, payment_type) where payment_type is not null;

create or replace function public.refresh_payment_types()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated int := 0;
begin
  with tx as (
    select c.id,
           count(t.*)::int                as n,
           sum(t.gross_amount_whole)      as total,
           max(t.time)::date              as last_charge
    from public.contacts c
    join lenus.transactions t on t.customer_id = c.lenus_id
    group by c.id
  )
  update public.contacts c set
    payment_type = case
      when tx.n = 1 then 'One payment'
      when tx.n >= 12 then 'Monthly, long-term'
      when tx.last_charge > current_date - 60 then 'Monthly, active'
      else 'Instalments, finished'
    end,
    -- Money in cents, per the repo convention. The import stores whole currency units.
    total_paid_cents = round(tx.total * 100)::bigint,
    charge_count     = tx.n,
    last_charge_on   = tx.last_charge
  from tx
  where c.id = tx.id;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'updated', v_updated);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$function$;

comment on function public.refresh_payment_types() is
  'Recomputes contacts.payment_type from the raw Lenus transaction history. Safe to re-run; it only touches contacts that join to a transaction.';

select public.refresh_payment_types();
