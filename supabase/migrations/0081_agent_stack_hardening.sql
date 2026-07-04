-- 0081 -- Hardening for the 2026 agent stack, from the launchproof + adversarial-review audit.
-- Fixes: (P0) kg_client_facts was PUBLIC EXECUTE + no company scope -> anon could read any client's
-- health PHI via PostgREST RPC; (P1) kg_rebuild left EXECUTE to 'authenticated' -> any member could
-- wipe/rebuild the graph; (bug) kg_rebuild edge joins keyed on lower(tok) while nodes use
-- lower(trim(tok)) -> padded tokens silently dropped edges; (tenant rule) ai_trace/eval_run
-- company_id were NULLABLE.

-- ---- (P0) kg_client_facts: company-scoped + service-role only -------------------------------
-- Now takes p_company and filters on it (multi-tenant safe for white-label), and the default PUBLIC
-- grant is revoked so it is only reachable via the service client (which is how coach context calls it).
drop function if exists public.kg_client_facts(uuid);
create or replace function public.kg_client_facts(p_contact uuid, p_company uuid)
returns table(rel text, node_type text, label text)
language sql stable security definer set search_path = public as $$
  select e.rel, n2.type, n2.label
  from kg_node n1
  join kg_edge e on e.src_id = n1.id
  join kg_node n2 on n2.id = e.dst_id
  where n1.type = 'client' and n1.ref_id = p_contact
    and n1.company_id = p_company and e.company_id = p_company
  order by e.weight desc, n2.label limit 60;
$$;
revoke all on function public.kg_client_facts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kg_client_facts(uuid, uuid) to service_role;

-- ---- (P1 + trim bug) kg_rebuild: lock down + fix the injury/dietary edge joins ---------------
create or replace function public.kg_rebuild(
  p_company uuid default 'c0ffee00-0000-4000-8000-000000000001',
  p_food_limit int default 140,
  p_foods_per_client int default 8
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_nodes int; v_edges int;
begin
  delete from kg_edge where company_id = p_company;
  delete from kg_node where company_id = p_company;

  insert into kg_node(company_id, type, key, label, weight)
  values (p_company, 'coach', 'coach:stephanie', 'Stephanie', 999);

  insert into kg_node(company_id, type, key, label, ref_id, weight, props)
  select p_company, 'client', 'client:' || c.id,
         nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
         c.id,
         greatest(1, (select count(*) from food_log fl where fl.contact_id = c.id)),
         jsonb_build_object('is_legacy', c.is_legacy, 'language', c.language)
  from contacts c
  where c.company_id = p_company
    and (exists (select 1 from client_intake ci where ci.contact_id = c.id)
      or exists (select 1 from meal_plans mp where mp.contact_id = c.id)
      or exists (select 1 from food_log fl where fl.contact_id = c.id));
  update kg_node n set label = coalesce(n.label, split_part(c.email, '@', 1), 'Client')
  from contacts c where n.ref_id = c.id and n.type = 'client' and n.label is null;
  update kg_node set label = 'Client' where company_id = p_company and type = 'client' and label is null;

  insert into kg_node(company_id, type, key, label, weight)
  select distinct p_company, 'goal', 'goal:' || goal_type,
         case goal_type when 'deficit' then 'Fat loss' when 'maintenance' then 'Maintenance'
                        when 'surplus' then 'Muscle gain' else initcap(goal_type) end, 60
  from client_intake where company_id = p_company and goal_type is not null;

  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'injury', 'injury:' || lower(trim(tok)),
         initcap(regexp_replace(min(trim(tok)), '([a-z])([A-Z])', '\1 \2', 'g')), 30 + count(*)
  from client_intake ci, unnest(ci.injuries) tok
  where ci.company_id = p_company and tok is not null and length(trim(tok)) > 0
  group by lower(trim(tok));

  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'dietary', 'dietary:' || lower(trim(tok)), initcap(min(trim(tok))), 25 + count(*)
  from client_intake ci, unnest(ci.dietary_exclusions) tok
  where ci.company_id = p_company and tok is not null and length(trim(tok)) > 0
  group by lower(trim(tok))
  on conflict (company_id, type, key) do nothing;

  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'food', 'food:' || lower(trim(name)), initcap(min(trim(name))), count(*)
  from food_log
  where company_id = p_company and name is not null and length(trim(name)) > 1
  group by lower(trim(name))
  order by count(*) desc
  limit p_food_limit;

  insert into kg_node(company_id, type, key, label, ref_id, weight)
  select p_company, 'plan', 'plan:' || mp.id, coalesce(nullif(trim(mp.name), ''), 'Meal plan'), mp.id, 40
  from meal_plans mp
  where mp.company_id = p_company and mp.contact_id is not null;

  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, h.id, cl.id, 'COACHES', 1
  from kg_node h, kg_node cl
  where h.company_id = p_company and h.type = 'coach'
    and cl.company_id = p_company and cl.type = 'client';

  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, cl.id, g.id, 'HAS_GOAL', 1
  from client_intake ci
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node g on g.company_id = p_company and g.type = 'goal' and g.key = 'goal:' || ci.goal_type
  where ci.company_id = p_company and ci.goal_type is not null
  on conflict do nothing;

  -- trim() to match the node keys (bug fix: nodes are lower(trim(tok)), so the join must be too).
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select distinct p_company, cl.id, inj.id, 'HAS_INJURY', 1
  from client_intake ci
  cross join lateral unnest(ci.injuries) tok
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node inj on inj.company_id = p_company and inj.type = 'injury' and inj.key = 'injury:' || lower(trim(tok))
  where ci.company_id = p_company
  on conflict do nothing;

  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select distinct p_company, cl.id, d.id, 'EXCLUDES', 1
  from client_intake ci
  cross join lateral unnest(ci.dietary_exclusions) tok
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node d on d.company_id = p_company and d.type = 'dietary' and d.key = 'dietary:' || lower(trim(tok))
  where ci.company_id = p_company
  on conflict do nothing;

  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, cl.id, p.id, 'FOLLOWS', 1
  from meal_plans mp
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = mp.contact_id
  join kg_node p on p.company_id = p_company and p.type = 'plan' and p.ref_id = mp.id
  where mp.company_id = p_company
  on conflict do nothing;

  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, src_id, dst_id, 'EATS', n
  from (
    select cl.id src_id, fn.id dst_id, count(*) n,
           row_number() over (partition by cl.id order by count(*) desc) rn
    from food_log fl
    join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = fl.contact_id
    join kg_node fn on fn.company_id = p_company and fn.type = 'food' and fn.key = 'food:' || lower(trim(fl.name))
    where fl.company_id = p_company and fl.name is not null
    group by cl.id, fn.id
  ) ranked
  where rn <= p_foods_per_client
  on conflict do nothing;

  select count(*) into v_nodes from kg_node where company_id = p_company;
  select count(*) into v_edges from kg_edge where company_id = p_company;
  return jsonb_build_object('nodes', v_nodes, 'edges', v_edges, 'rebuilt_at', now());
end $$;
revoke all on function public.kg_rebuild(uuid, int, int) from public, anon, authenticated;
grant execute on function public.kg_rebuild(uuid, int, int) to service_role;

-- ---- (tenant rule) ai_trace + eval_run company_id: default the tenant, backfill, NOT NULL -----
-- The single tenant owns every row; system/embed/eval traces that had no company context default to
-- it. Column default means an omitted company_id lands on the tenant instead of NULL.
alter table public.ai_trace alter column company_id set default 'c0ffee00-0000-4000-8000-000000000001';
update public.ai_trace set company_id = 'c0ffee00-0000-4000-8000-000000000001' where company_id is null;
alter table public.ai_trace alter column company_id set not null;

alter table public.eval_run alter column company_id set default 'c0ffee00-0000-4000-8000-000000000001';
update public.eval_run set company_id = 'c0ffee00-0000-4000-8000-000000000001' where company_id is null;
alter table public.eval_run alter column company_id set not null;
