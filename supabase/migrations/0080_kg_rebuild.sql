-- 0080 -- Deterministic knowledge-graph builder. Reads the migrated structured data (client intake,
-- meal plans, food logs) and (re)builds kg_node/kg_edge. Full rebuild per company - safe + cheap at
-- our scale (~600 nodes / ~2.5K edges). Powers the admin graph refresh button + a nightly cron. The
-- LLM triple-extraction over free-text (bad_habits, coaching messages) is a later enrichment layer;
-- this deterministic pass from clean columns is what makes the graph dense today.
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

  -- ---- NODES -------------------------------------------------------------------------------
  -- Coach hub (the gravitational center - every client hangs off Stephanie).
  insert into kg_node(company_id, type, key, label, weight)
  values (p_company, 'coach', 'coach:stephanie', 'Stephanie', 999);

  -- Clients: any contact with real activity (intake, a plan, or food logs). Weight = log volume.
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
  -- Fill missing labels with the email local-part so no node is blank.
  update kg_node n set label = coalesce(n.label, split_part(c.email, '@', 1), 'Client')
  from contacts c where n.ref_id = c.id and n.type = 'client' and n.label is null;
  update kg_node set label = 'Client' where company_id = p_company and type = 'client' and label is null;

  -- Goals (clean enum).
  insert into kg_node(company_id, type, key, label, weight)
  select distinct p_company, 'goal', 'goal:' || goal_type,
         case goal_type when 'deficit' then 'Fat loss' when 'maintenance' then 'Maintenance'
                        when 'surplus' then 'Muscle gain' else initcap(goal_type) end, 60
  from client_intake where company_id = p_company and goal_type is not null;

  -- Injuries (text[] tokens: knee, lowerBack, shoulder, ...). Group by the lowered key so two
  -- casings of the same token collapse to one node.
  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'injury', 'injury:' || lower(trim(tok)),
         initcap(regexp_replace(min(trim(tok)), '([a-z])([A-Z])', '\1 \2', 'g')), 30 + count(*)
  from client_intake ci, unnest(ci.injuries) tok
  where ci.company_id = p_company and tok is not null and length(trim(tok)) > 0
  group by lower(trim(tok));

  -- Dietary exclusions (text[]).
  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'dietary', 'dietary:' || lower(trim(tok)), initcap(min(trim(tok))), 25 + count(*)
  from client_intake ci, unnest(ci.dietary_exclusions) tok
  where ci.company_id = p_company and tok is not null and length(trim(tok)) > 0
  group by lower(trim(tok))
  on conflict (company_id, type, key) do nothing;

  -- Foods: the p_food_limit most-logged distinct names (keeps the graph dense but legible).
  insert into kg_node(company_id, type, key, label, weight)
  select p_company, 'food', 'food:' || lower(trim(name)), initcap(min(trim(name))), count(*)
  from food_log
  where company_id = p_company and name is not null and length(trim(name)) > 1
  group by lower(trim(name))
  order by count(*) desc
  limit p_food_limit;

  -- Plans (non-template, tied to a client). Templates without a contact stay off the graph.
  insert into kg_node(company_id, type, key, label, ref_id, weight)
  select p_company, 'plan', 'plan:' || mp.id, coalesce(nullif(trim(mp.name), ''), 'Meal plan'), mp.id, 40
  from meal_plans mp
  where mp.company_id = p_company and mp.contact_id is not null;

  -- ---- EDGES -------------------------------------------------------------------------------
  -- coach COACHES client
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, h.id, cl.id, 'COACHES', 1
  from kg_node h, kg_node cl
  where h.company_id = p_company and h.type = 'coach'
    and cl.company_id = p_company and cl.type = 'client';

  -- client HAS_GOAL goal
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, cl.id, g.id, 'HAS_GOAL', 1
  from client_intake ci
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node g on g.company_id = p_company and g.type = 'goal' and g.key = 'goal:' || ci.goal_type
  where ci.company_id = p_company and ci.goal_type is not null
  on conflict do nothing;

  -- client HAS_INJURY injury
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select distinct p_company, cl.id, inj.id, 'HAS_INJURY', 1
  from client_intake ci
  cross join lateral unnest(ci.injuries) tok
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node inj on inj.company_id = p_company and inj.type = 'injury' and inj.key = 'injury:' || lower(tok)
  where ci.company_id = p_company
  on conflict do nothing;

  -- client EXCLUDES dietary
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select distinct p_company, cl.id, d.id, 'EXCLUDES', 1
  from client_intake ci
  cross join lateral unnest(ci.dietary_exclusions) tok
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = ci.contact_id
  join kg_node d on d.company_id = p_company and d.type = 'dietary' and d.key = 'dietary:' || lower(tok)
  where ci.company_id = p_company
  on conflict do nothing;

  -- client FOLLOWS plan
  insert into kg_edge(company_id, src_id, dst_id, rel, weight)
  select p_company, cl.id, p.id, 'FOLLOWS', 1
  from meal_plans mp
  join kg_node cl on cl.company_id = p_company and cl.type = 'client' and cl.ref_id = mp.contact_id
  join kg_node p on p.company_id = p_company and p.type = 'plan' and p.ref_id = mp.id
  where mp.company_id = p_company
  on conflict do nothing;

  -- client EATS food (each client's top p_foods_per_client logged foods that made the food-node cut).
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

revoke all on function public.kg_rebuild(uuid, int, int) from public, anon;
grant execute on function public.kg_rebuild(uuid, int, int) to service_role;
