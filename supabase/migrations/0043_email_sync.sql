-- 0043 PHASE 2 — Keep profiles.email in sync with auth.users.email on email change.
-- profiles.email is a denormalized copy of the auth identity. handle_new_user (0004) sets it at
-- signup, but nothing updated it afterward, so an in-app "change email" (Supabase Secure Email
-- Change) would update auth.users.email on confirmation and leave profiles.email stale. This adds
-- an AFTER UPDATE trigger on auth.users that mirrors a confirmed email change into public.profiles.

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Only act when the email actually changed (the confirmation flow rewrites auth.users.email).
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$function$;

comment on function public.handle_user_email_change() is
  'Mirrors a confirmed auth.users email change into the denormalized public.profiles.email. '
  'Paired with the in-app change-email flow (Supabase Secure Email Change).';

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_change();
