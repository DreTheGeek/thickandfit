-- PRD-00 IMPORT: Lenus -> CRM contacts. Runs as ONE transaction (Management API).
-- Idempotent (re-runnable). Ends with the legacy firewall gate (aborts all on violation).

-- 0) ensure the funnel-link column exists on the live table
alter table public.contacts add column if not exists was_lead boolean not null default false;

-- 1) categorized tag taxonomy (7 categories), editable later in the UI
insert into public.tags (company_id, category, label, slug, color, is_system, source)
select co.id, v.category, v.label, v.slug, v.color, true, 'lenus'
from public.companies co,
  (values
    ('program','6-Week Body Recomp','6-week-body-recomp','#5EBE62'),
    ('program','HER Again Challenge','her-again-challenge','#5EBE62'),
    ('tier','Bronze','bronze','#B08D57'),
    ('tier','Platinum','platinum','#8A8A99'),
    ('tier','TLC','tlc','#8A8A99'),
    ('health','PCOS','pcos','#E06C75'),
    ('health','GLP-1','glp-1','#E06C75'),
    ('service','Workout Only','workout-only','#4A90D9'),
    ('service','Nutrition Only','nutrition-only','#4A90D9'),
    ('lifecycle','Cancelling','cancelling','#D9534F'),
    ('language','Spanish','spanish','#F0AD4E'),
    ('special','Bride','bride','#C678DD'),
    ('special','Special Request','special-request','#C678DD')
  ) as v(category,label,slug,color)
where co.slug = 'thick-and-fit'
on conflict (company_id, slug) do nothing;

-- 2) clients -> contacts (type=client), legacy firewall stamped
insert into public.contacts
  (company_id, type, lifecycle_stage, first_name, last_name, email, owner, source,
   is_legacy, legacy_source, lenus_id, product_type)
select co.id, 'client',
  case c.subscription_status
    when 'active' then 'active' when 'past_due' then 'past_due'
    when 'unpaid' then 'unpaid' when 'canceled' then 'canceled' else 'churned' end,
  nullif(c.first_name,''), nullif(c.last_name,''), c.email, nullif(c.owner,''), 'lenus',
  true, 'lenus', c.id, nullif(c.product_type,'')
from public.companies co, lenus.clients c
where co.slug = 'thick-and-fit'
  and not exists (select 1 from public.contacts x
                  where x.company_id = co.id and x.type='client' and x.lenus_id = c.id);

-- 3) subscriptions: grandfathered price + status + billing health
insert into public.client_subscriptions
  (company_id, contact_id, status, billing_health, product_type, grandfathered_price_cents,
   currency, is_auto_renew, started_at, ended_at, next_billing_date, next_amount_cents,
   lifetime_paid_cents, is_legacy, source)
select co.id, ct.id,
  case c.subscription_status
    when 'active' then 'active' when 'past_due' then 'past_due'
    when 'unpaid' then 'unpaid' when 'canceled' then 'canceled' else 'churned' end,
  nullif(ab.billing_health,''), coalesce(nullif(ab.product_type,''), nullif(c.product_type,'')),
  round(coalesce(nullif(ab.monthly_amount,0), lt.last_txn, nullif(rs.next_amount,0)) * 100)::bigint,
  coalesce(nullif(rs.currency,''),'USD'),
  c.is_auto_renew, c.start_at, c.end_at, rs.next_billing_date,
  round(nullif(rs.next_amount,0) * 100)::bigint,
  round(nullif(ab.lifetime_paid,0) * 100)::bigint,
  true, 'lenus'
from public.companies co
join lenus.clients c on true
join public.contacts ct on ct.company_id = co.id and ct.type='client' and ct.lenus_id = c.id
left join lenus.active_billing ab on ab.client_id = c.id
left join lenus.renewal_schedule rs on lower(rs.email) = lower(c.email)
left join lateral (
  select gross_amount_whole as last_txn from lenus.transactions t
  where t.customer_id = c.id order by t.time desc nulls last limit 1
) lt on true
where co.slug = 'thick-and-fit'
  and not exists (select 1 from public.client_subscriptions s where s.contact_id = ct.id);

-- 4) engagement snapshot
insert into public.legacy_client_snapshot
  (contact_id, company_id, meal_plans, measurements_logged, checkins, workouts_completed,
   messages_in_window, health_assessment, weight_goal, goal_intensity, source)
select ct.id, co.id, p.meal_plans, p.measurements_logged, p.checkins, p.workouts_completed,
  p.messages_in_window, p.health_assessment, nullif(p.weight_goal,''), nullif(p.goal_intensity,''), 'lenus'
from public.companies co
join lenus.client_profiles p on true
join public.contacts ct on ct.company_id = co.id and ct.type='client' and ct.lenus_id = p.profile_id
where co.slug = 'thick-and-fit'
on conflict (contact_id) do nothing;

-- 5) leads -> contacts (type=lead), skipping anyone already a client (dedupe by email)
insert into public.contacts
  (company_id, type, lifecycle_stage, first_name, last_name, email, phone, source,
   is_legacy, legacy_source, lenus_id, lead_stage, lead_type, lost_reason, is_referred, is_duplicate)
select co.id, 'lead',
  case l.state when 'Won' then 'won' when 'Lost' then 'lost' else 'lead' end,
  nullif(l.first_name,''), nullif(l.last_name,''), l.email, nullif(l.phone,''), 'lenus',
  true, 'lenus', l.id, nullif(l.state,''), nullif(l.lead_type,''), nullif(l.lost_reason,''),
  coalesce(l.is_referred,false), coalesce(l.is_duplicate,false)
from public.companies co, lenus.leads l
where co.slug = 'thick-and-fit'
  and not exists (select 1 from public.contacts xc
                  where xc.company_id = co.id and xc.type='client' and lower(xc.email) = lower(l.email))
  and not exists (select 1 from public.contacts xl
                  where xl.company_id = co.id and xl.type='lead' and xl.lenus_id = l.id);

-- 6) mark clients who originated as a lead (funnel link)
update public.contacts ct
set was_lead = true,
    lead_stage = coalesce(ct.lead_stage, l.state),
    lead_type = coalesce(ct.lead_type, l.lead_type)
from lenus.leads l, public.companies co
where co.slug = 'thick-and-fit' and ct.company_id = co.id
  and ct.type='client' and lower(ct.email) = lower(l.email);

-- 7) transactions (linked to client contact by lenus customer id where possible)
insert into public.contact_transactions
  (company_id, contact_id, lenus_txn_id, lenus_customer_id, occurred_at, category,
   gross_cents, coach_cents, currency, is_pt_client, is_independent, source)
select co.id, ct.id, t.id::text, t.customer_id, t.time, nullif(t.category,''),
  round(nullif(t.gross_amount_whole,0) * 100)::bigint,
  round(nullif(t.coach_amount_whole,0) * 100)::bigint,
  coalesce(nullif(t.currency,''),'USD'), t.is_pt_client, t.is_independent, 'lenus'
from public.companies co
join lenus.transactions t on true
left join public.contacts ct on ct.company_id = co.id and ct.type='client' and ct.lenus_id = t.customer_id
where co.slug = 'thick-and-fit'
  and not exists (select 1 from public.contact_transactions x
                  where x.company_id = co.id and x.lenus_txn_id = t.id::text);

-- 8) tags: clients
insert into public.contact_tags (contact_id, tag_id, company_id)
select distinct ct.id, tg.id, co.id
from public.companies co
join lenus.clients c on true
join public.contacts ct on ct.company_id = co.id and ct.type='client' and ct.lenus_id = c.id
cross join lateral unnest(string_to_array(c.tags, ';')) as raw(val)
join public.tags tg on tg.company_id = co.id and tg.slug = (
  case trim(both ' ' from lower(raw.val))
    when 'thick & fit 6 week body recomp challenge' then '6-week-body-recomp'
    when 'her again challenge' then 'her-again-challenge'
    when 'bronze monthly zoom calls with steph' then 'bronze'
    when 'platimum 2x monthly zoom' then 'platinum'
    when 'tlc' then 'tlc'
    when 'pcos' then 'pcos'
    when 'glp1' then 'glp-1'
    when 'workout only' then 'workout-only'
    when 'nutrition only' then 'nutrition-only'
    when 'cancelling' then 'cancelling'
    when 'spanish' then 'spanish'
    when 'bride' then 'bride'
    when 'special request' then 'special-request'
    else null end)
where co.slug = 'thick-and-fit' and c.tags is not null and c.tags <> ''
on conflict (contact_id, tag_id) do nothing;

-- 8b) tags: leads (apply to the lead contact, or to the client contact if they converted)
insert into public.contact_tags (contact_id, tag_id, company_id)
select distinct ct.id, tg.id, co.id
from public.companies co
join lenus.leads l on true
join public.contacts ct on ct.company_id = co.id
   and ((ct.type='lead' and ct.lenus_id = l.id) or (ct.type='client' and lower(ct.email) = lower(l.email)))
cross join lateral unnest(string_to_array(l.tags, ';')) as raw(val)
join public.tags tg on tg.company_id = co.id and tg.slug = (
  case trim(both ' ' from lower(raw.val))
    when 'thick & fit 6 week body recomp challenge' then '6-week-body-recomp'
    when 'her again challenge' then 'her-again-challenge'
    when 'bronze monthly zoom calls with steph' then 'bronze'
    when 'platimum 2x monthly zoom' then 'platinum'
    when 'tlc' then 'tlc'
    when 'pcos' then 'pcos'
    when 'glp1' then 'glp-1'
    when 'workout only' then 'workout-only'
    when 'nutrition only' then 'nutrition-only'
    when 'cancelling' then 'cancelling'
    when 'spanish' then 'spanish'
    when 'bride' then 'bride'
    when 'special request' then 'special-request'
    else null end)
where co.slug = 'thick-and-fit' and l.tags is not null and l.tags <> ''
on conflict (contact_id, tag_id) do nothing;

-- 9) language: Spanish-tagged -> es, rest -> en
update public.contacts ct set language = 'es'
from public.contact_tags cct
join public.tags tg on tg.id = cct.tag_id and tg.slug = 'spanish'
where cct.contact_id = ct.id and ct.source = 'lenus';
update public.contacts set language = 'en'
where source = 'lenus' and language is null;

-- 10) migration_log summary
insert into public.migration_log (company_id, lenus_id, dataset, records_imported, status)
select co.id, 'BATCH', d.dataset, d.n, 'imported'
from public.companies co,
  (select 'contacts_clients' dataset, (select count(*) from public.contacts where type='client' and source='lenus') n
   union all select 'contacts_leads', (select count(*) from public.contacts where type='lead' and source='lenus')
   union all select 'subscriptions', (select count(*) from public.client_subscriptions where source='lenus')
   union all select 'snapshots', (select count(*) from public.legacy_client_snapshot where source='lenus')
   union all select 'transactions', (select count(*) from public.contact_transactions where source='lenus')
   union all select 'contact_tags', (select count(*) from public.contact_tags)) d
where co.slug = 'thick-and-fit';

-- 11) LEGACY FIREWALL GATE: any lenus-sourced contact missing is_legacy aborts the whole import
do $$
declare v_bad int;
begin
  select count(*) into v_bad from public.contacts where source = 'lenus' and is_legacy = false;
  if v_bad > 0 then
    raise exception 'LEGACY FIREWALL TRIPPED: % lenus contact(s) missing is_legacy flag - import aborted', v_bad;
  end if;
end $$;
