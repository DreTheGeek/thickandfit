-- Capture the member's name at ACCOUNT CREATION, whatever path created it.
--
-- The trigger copied id, company, email and role only. The email signup path compensated by writing
-- profiles.full_name immediately afterwards in signUpAction, but OAuth has no such step: /auth/callback
-- only reads `role` to pick a destination. So a Google signup landed with full_name NULL even though
-- Google had just handed us the name, and it stayed NULL until the member finished onboarding.
--
-- In that window the dashboard greeted her as "HEY" with nothing after it, and she showed up nameless
-- in the coach's client list. We had the name the whole time.
--
-- Fixing it in the trigger rather than in the callback means it holds for EVERY path that can ever
-- create a user: email, Google, a future Apple sign-in, an admin invite, or a direct insert. A fix in
-- one route handler would have to be repeated in the next one, which is how the original gap happened.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company uuid;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
begin
  select id into v_company from public.companies where slug = 'thick-and-fit' limit 1;

  -- Providers disagree on the field name, so try them in order of how explicit they are:
  --   full_name  our own email signup form, and Google
  --   name       Google's alternate key, and most OIDC providers
  --   given/family  Google and Apple send these split
  -- nullif(trim(...)) so a provider sending "" or " " does not create a blank-looking name that
  -- reads as set-but-empty everywhere downstream.
  v_name := nullif(trim(coalesce(
    v_meta ->> 'full_name',
    v_meta ->> 'name',
    trim(concat_ws(' ', v_meta ->> 'given_name', v_meta ->> 'family_name')),
    trim(concat_ws(' ', v_meta ->> 'first_name', v_meta ->> 'last_name'))
  )), '');

  insert into public.profiles (id, company_id, email, role, full_name)
  values (new.id, v_company, new.email, 'subscriber', v_name)
  on conflict (id) do nothing;
  return new;
end;
$function$;

comment on function public.handle_new_user() is
  'Creates the profile row on auth.users insert. Extracts the display name from raw_user_meta_data so OAuth signups arrive named: Google hands us the name at signup and it was previously discarded until onboarding.';
