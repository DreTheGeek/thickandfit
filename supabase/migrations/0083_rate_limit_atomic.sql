-- Atomic rate-limit check. The app previously did a SELECT count() then a separate INSERT from
-- application code (src/lib/security/rate-limit.ts); under concurrency two hits could both read a
-- count below the limit and both slip through. This SECURITY DEFINER function serializes callers
-- that share an (identifier, bucket) key via a transaction-scoped advisory lock, so the count-and-
-- record is race-free. Returns true when the action is allowed (and records the hit), false when
-- the caller is over the limit within the window.
create or replace function public.check_rate_limit(
  p_identifier text,
  p_bucket text,
  p_limit int,
  p_window_sec int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Serialize concurrent callers for this exact key; the lock releases at transaction end.
  perform pg_advisory_xact_lock(hashtext(p_identifier || ':' || p_bucket));

  select count(*) into v_count
  from public.rate_limit_log
  where identifier = p_identifier
    and bucket = p_bucket
    and hit_at >= now() - make_interval(secs => p_window_sec);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_log (identifier, bucket) values (p_identifier, p_bucket);
  return true;
end;
$$;

-- Callable only by the service role (the limiter always runs on the service client); never exposed
-- to anon/authenticated, matching the lockdown pattern used for the other definer helpers.
revoke all on function public.check_rate_limit(text, text, int, int) from public;
revoke all on function public.check_rate_limit(text, text, int, int) from anon;
revoke all on function public.check_rate_limit(text, text, int, int) from authenticated;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;
