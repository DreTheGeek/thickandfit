-- 0021 Surface more of the already-imported Lenus data on the client detail: last-charge
-- intelligence and plan-delivery dates. (next_billing_date / next_amount_cents / is_auto_renew
-- columns already exist; this migration adds the rest. The data backfill runs separately.)
alter table public.client_subscriptions
  add column if not exists last_charge_date date,
  add column if not exists num_charges int,
  add column if not exists days_since_last_charge int,
  add column if not exists meal_plan_sent_at date,
  add column if not exists workout_plan_sent_at date;
