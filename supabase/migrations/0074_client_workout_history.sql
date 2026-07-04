-- 0074 -- Migrated Lenus workout history (the SUMMARY per completed session: name, plan, completion %,
-- enjoyment/exhaustion, date). Distinct from native workout_logs+set_logs (which hold set-by-set data
-- for sessions performed IN this app). Contact-keyed like the other migrated history; profile_id is
-- backfilled on account claim. Unique external_id makes the import idempotent.

create table if not exists public.client_workout_history (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  profile_id        uuid references public.profiles(id) on delete set null,
  external_id       text,
  session_name      text,
  plan_name         text,
  completion_pct    int,
  enjoyment         int,
  exhaustion        int,
  is_client_created boolean,
  performed_at      timestamptz not null,
  source            text not null default 'lenus',
  created_at        timestamptz not null default now(),
  unique (company_id, external_id)
);

create index if not exists idx_client_workout_history_contact on public.client_workout_history (contact_id, performed_at desc);
create index if not exists idx_client_workout_history_profile on public.client_workout_history (profile_id, performed_at desc) where profile_id is not null;

alter table public.client_workout_history enable row level security;

drop policy if exists client_workout_history_coach_rw on public.client_workout_history;
create policy client_workout_history_coach_rw on public.client_workout_history for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

drop policy if exists client_workout_history_owner_read on public.client_workout_history;
create policy client_workout_history_owner_read on public.client_workout_history for select
  using (company_id = public.current_company_id() and profile_id = auth.uid());

comment on table public.client_workout_history is
  'Migrated Lenus workout-session summaries (contact-keyed; profile_id backfilled on claim).';

-- Extend the claim flow to also transfer workout history onto the new profile.
create or replace function public.claim_legacy_contact()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid := public.current_company_id();
  v_email text;
  v_contact public.contacts;
begin
  if v_uid is null or v_company is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_session');
  end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_email');
  end if;
  select * into v_contact
  from public.contacts
  where company_id = v_company and type = 'client' and is_legacy = true and profile_id is null and lower(email) = v_email
  limit 1;
  if v_contact.id is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_match');
  end if;

  update public.contacts set profile_id = v_uid, updated_at = now() where id = v_contact.id and profile_id is null;
  update public.profiles set is_legacy_client = true, legacy_source = 'lenus', lenus_profile_id = v_contact.lenus_id where id = v_uid;

  update public.weight_entries        set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.body_measurements     set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.progress_photos       set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.food_log              set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_intake         set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_messages       set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_workout_history set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;

  return jsonb_build_object('claimed', true, 'contact_id', v_contact.id, 'lenus_id', v_contact.lenus_id);
end;
$$;
revoke all on function public.claim_legacy_contact() from public;
grant execute on function public.claim_legacy_contact() to authenticated;
