-- 0071 -- Extend the legacy-claim RPC to TRANSFER migrated history to the new profile. 0070 lets a
-- migrated client's weight / measurement / photo / food history + intake attach to their CRM contact
-- before they sign up. When they claim their account (0042), that history must move onto their profile
-- so it appears in their own progress screens (not just the coach's client view). This recreates
-- claim_legacy_contact() with the same match-by-email logic, then backfills profile_id from contact_id
-- on every migrated row. Still scoped to the caller's own auth.uid + tenant + email; idempotent.

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
  where company_id = v_company
    and type = 'client'
    and is_legacy = true
    and profile_id is null
    and lower(email) = v_email
  limit 1;

  if v_contact.id is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_match');
  end if;

  update public.contacts
    set profile_id = v_uid, updated_at = now()
  where id = v_contact.id and profile_id is null;

  update public.profiles
    set is_legacy_client = true, legacy_source = 'lenus', lenus_profile_id = v_contact.lenus_id
  where id = v_uid;

  -- Transfer migrated history from the contact to the newly claimed profile. Each update is scoped to
  -- this one contact's rows, so no other client's data can move. profile_id is null guard keeps it
  -- idempotent and never clobbers data the member has since logged themselves.
  update public.weight_entries    set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.body_measurements set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.progress_photos   set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.food_log          set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_intake     set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;

  return jsonb_build_object('claimed', true, 'contact_id', v_contact.id, 'lenus_id', v_contact.lenus_id);
end;
$$;

revoke all on function public.claim_legacy_contact() from public;
grant execute on function public.claim_legacy_contact() to authenticated;

comment on function public.claim_legacy_contact() is
  'Reconciles the caller with their unclaimed legacy Lenus contact by email within the tenant, then '
  'transfers migrated weight/measurement/photo/food/intake history onto the new profile. No-op for new '
  'signups. Idempotent.';
