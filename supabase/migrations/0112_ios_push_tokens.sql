-- Let push_subscriptions hold an iOS device token as well as a Web Push subscription.
--
-- The two are not the same shape. Web Push is an endpoint URL plus two encryption keys (p256dh,
-- auth) and is sent through a browser push service with VAPID. Apple push is a single opaque device
-- token sent to APNs with a signed key. Same intent, different envelope.
--
-- One table rather than two, because everything that reads this asks the same question: "how do I
-- reach this member". Splitting it would mean every sender learning about both, and the sender is
-- exactly the code that must not grow a second way to forget somebody.
--
-- WHY NOW. The iOS shell needs somewhere to put the token the moment Apple issues one. Storing it is
-- independent of sending to it: sending needs an APNs key from the Apple developer account, which
-- does not exist yet. Getting the storage right first means the day the key arrives, every member who
-- has already opened the app is reachable, rather than everyone having to re-grant permission.

alter table public.push_subscriptions
  add column if not exists platform     text not null default 'web',
  add column if not exists device_token text,
  add column if not exists last_seen_at timestamptz not null default now();

-- Web Push needs its keys; an APNs row has none. The original NOT NULLs would reject every iOS row.
alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh  drop not null;
alter table public.push_subscriptions alter column auth    drop not null;

-- Whichever kind of row it is, it has to be complete enough to actually send to. Without this a
-- half-written row looks like a reachable member and silently is not.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_shape_ck;
alter table public.push_subscriptions add constraint push_subscriptions_shape_ck check (
  (platform = 'web' and endpoint is not null and p256dh is not null and auth is not null)
  or (platform = 'ios' and device_token is not null)
);

-- One row per device, so reopening the app updates rather than accumulates. A member who reinstalls
-- gets a new token and a new row, which is correct: the old token stops working and APNs will say so.
create unique index if not exists push_subscriptions_device_uidx
  on public.push_subscriptions (profile_id, device_token) where device_token is not null;

create index if not exists push_subscriptions_platform_idx
  on public.push_subscriptions (company_id, platform);

comment on column public.push_subscriptions.platform is
  'web = Web Push (endpoint + p256dh + auth). ios = APNs (device_token). The shape check enforces that the row is complete for its kind.';
comment on column public.push_subscriptions.last_seen_at is
  'Touched every time the app registers. A token nobody has refreshed in months is a member who deleted the app, and is worth pruning before it becomes a silent send failure.';
