-- Make the iOS device-token upsert actually reach the table.
--
-- 0112 created push_subscriptions_device_uidx as a PARTIAL unique index:
--
--   create unique index ... on (profile_id, device_token) where device_token is not null;
--
-- and /api/native/push-token upserts with onConflict 'profile_id,device_token'. PostgREST turns that
-- into `on conflict (profile_id, device_token)` with no index predicate, and Postgres will not infer
-- a partial index from a bare column list. Every call therefore failed with:
--
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- The route catches its own error, logs it and returns 200 so a working app does not show a failure
-- the member cannot act on. Correct for the member, and it also meant this failed SILENTLY: not one
-- device token was ever stored, and the endpoint looked healthy from the outside. That is the exact
-- outcome 0112 set out to avoid, since the whole point of storing tokens before the APNs key exists
-- is that nobody has to be re-prompted later.
--
-- The predicate cannot be added on the query side: PostgREST's onConflict takes column names only and
-- has no way to express a WHERE. So the index becomes non-partial instead.
--
-- Dropping the predicate does NOT change what the table allows. Under the default NULLS DISTINCT,
-- two NULLs are never equal, so every Web Push row (device_token IS NULL) is still distinct from
-- every other one and a profile keeps as many browser subscriptions as it likes. The only rows the
-- index constrains are those with a real token, which is what the partial predicate was expressing.
-- Verified before applying: inference succeeds, a repeat token updates rather than duplicates, and
-- three NULL-token rows for one profile still insert cleanly.

drop index if exists public.push_subscriptions_device_uidx;

create unique index if not exists push_subscriptions_device_uidx
  on public.push_subscriptions (profile_id, device_token);

comment on index public.push_subscriptions_device_uidx is
  'Deliberately NOT partial. ON CONFLICT (profile_id, device_token) cannot infer a partial index, and PostgREST cannot send the predicate. NULLS DISTINCT already leaves Web Push rows (device_token IS NULL) unconstrained.';
