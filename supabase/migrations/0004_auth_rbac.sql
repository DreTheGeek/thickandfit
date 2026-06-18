-- PRD-04: auth wiring on the PRD-01 baseline. No new tables.
-- (1) Auto-create a profile when an auth user is created (default tenant + subscriber role).
-- (2) Custom access token hook: inject company_id + user_role into the JWT so RLS
--     policies (company_id = current_company_id()) and role guards work for authed users.

-- (1) profile on signup ------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select id into v_company from public.companies where slug = 'thick-and-fit' limit 1;
  insert into public.profiles (id, company_id, email, role)
  values (new.id, v_company, new.email, 'subscriber')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- (2) custom access token hook ----------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb;
  v_company_id uuid;
  v_role text;
begin
  select company_id, role into v_company_id, v_role
  from public.profiles where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);
  if v_company_id is not null then
    claims := jsonb_set(claims, '{company_id}', to_jsonb(v_company_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The hook runs as supabase_auth_admin; it must read profiles and execute the fn.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
