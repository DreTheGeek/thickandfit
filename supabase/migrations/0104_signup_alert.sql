-- Announce every new signup in Telegram, from Postgres.
--
-- WHY HERE AND NOT IN THE SIGNUP CODE. A profile row can be born four ways: the email form, Google,
-- an admin invite, a direct insert. Wiring the notification into one of them is how the next one
-- arrives silently, which is the same mistake 0101 fixed for the display name. The row landing in
-- `profiles` is the one thing every path has in common.
--
-- It also means signups still announce themselves when the app's host is unreachable. On 2026-08-01
-- Vercel was soft-blocked for two days and every scheduled job got a 402; a notification living in
-- the app would have gone quiet for exactly as long.

-- The edge function talks to Postgres through PostgREST, which cannot see the `auth` schema. This is
-- the narrow, read-only window it needs: providers for ONE user, nothing else.
create or replace function public.auth_providers_for(p_user uuid)
returns text[]
language sql
security definer
set search_path to 'public'
stable
as $function$
  select coalesce(array_agg(distinct i.provider order by i.provider), array[]::text[])
  from auth.identities i
  where i.user_id = p_user;
$function$;

revoke all on function public.auth_providers_for(uuid) from public, anon, authenticated;
grant execute on function public.auth_providers_for(uuid) to service_role;

comment on function public.auth_providers_for(uuid) is
  'Sign-in providers for one user. SECURITY DEFINER because PostgREST cannot read auth.identities; granted to service_role only, since knowing how an account authenticates is not member-visible information.';


create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  -- The bearer comes from Vault. Inlining it here would put the literal in a function body that is
  -- readable by anything with DB access, which is the pattern being retired everywhere else.
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://cpwesaeyhklmjbqppeah.supabase.co/functions/v1/ops-bot/signup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('profile_id', new.id),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  -- THIS GUARD IS THE POINT. The trigger runs inside the transaction that creates the account, via
  -- handle_new_user() on auth.users. An exception escaping here does not lose a notification, it
  -- fails the SIGNUP, and a broken trigger on auth.users surfaces as GoTrue's opaque "Database error
  -- querying schema" with no hint of the cause. A missing Telegram message is a rounding error
  -- against not being able to create an account at all.
  raise warning 'notify_new_signup failed for %: %', new.id, sqlerrm;
  return new;
end;
$function$;

comment on function public.notify_new_signup() is
  'Posts a new profile id to the ops-bot edge function so the signup is announced in Telegram. Swallows every error: it runs inside the account-creation transaction and must never be able to fail a signup.';

drop trigger if exists notify_new_signup_trg on public.profiles;
create trigger notify_new_signup_trg
  after insert on public.profiles
  for each row execute function public.notify_new_signup();
