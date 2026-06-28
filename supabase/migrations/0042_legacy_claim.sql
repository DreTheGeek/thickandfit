-- 0042 WP13: legacy-client claim. Turns a freshly signed-in auth user into their pre-existing
-- legacy contact (imported from Lenus in 0020 via import-lenus.sql) instead of leaving the blank
-- subscriber profile that handle_new_user() (0004_auth_rbac.sql) unconditionally created.
--
-- The trigger ALWAYS fires on signup, so this RPC must RECONCILE, not duplicate: it matches an
-- unclaimed legacy contact BY EMAIL within the caller's tenant, then links the rows. It is a no-op
-- for a genuinely new signup (no legacy contact matches) and idempotent on re-call (the guard
-- requires contacts.profile_id IS NULL, so a second call finds nothing to claim).
--
-- SECURITY DEFINER: the claim writes contacts (a coach/operator table the subscriber cannot touch
-- under RLS) on behalf of the authenticated caller. It is tightly scoped: it only ever acts on the
-- caller's OWN auth.uid(), only within current_company_id(), only on is_legacy + unclaimed rows,
-- and only matches the caller's verified email. It cannot link another user's contact.

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

  -- The caller's verified email from auth.users (NOT a client-supplied value).
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_email');
  end if;

  -- Find ONE unclaimed legacy client contact in this tenant whose email matches the caller.
  select * into v_contact
  from public.contacts
  where company_id = v_company
    and type = 'client'
    and is_legacy = true
    and profile_id is null
    and lower(email) = v_email
  limit 1;

  if v_contact.id is null then
    -- Genuinely new signup, or already claimed: leave the blank subscriber profile untouched.
    return jsonb_build_object('claimed', false, 'reason', 'no_match');
  end if;

  -- Link the legacy contact to this auth user.
  update public.contacts
    set profile_id = v_uid,
        updated_at = now()
  where id = v_contact.id
    and profile_id is null;             -- re-check guards a race; no double-claim

  -- Stamp the profile as a claimed legacy client so the app can surface the journey card
  -- and the photo import can target this profile.
  update public.profiles
    set is_legacy_client = true,
        legacy_source = 'lenus',
        lenus_profile_id = v_contact.lenus_id
  where id = v_uid;

  return jsonb_build_object(
    'claimed', true,
    'contact_id', v_contact.id,
    'lenus_id', v_contact.lenus_id
  );
end;
$$;

-- Only an authenticated user may claim (acts on auth.uid()). Revoke the public/anon grant.
revoke all on function public.claim_legacy_contact() from public;
grant execute on function public.claim_legacy_contact() to authenticated;

comment on function public.claim_legacy_contact() is
  'WP13: reconciles the caller (auth.uid) with their unclaimed legacy Lenus contact by email within the tenant. No-op for new signups. Idempotent.';
