-- 0031 PHASE 2: Notification layer.
-- Two tables: in-app notifications (the bell + /notifications center) and web-push subscriptions.
-- Both company-scoped and owner-RLS. Coaches may also read their members' notifications so a coach
-- can audit what was delivered; subscribers only ever see their own. Push subscriptions are
-- strictly owner-only (they are device credentials).

-- ---------------------------------------------------------------------------------------------
-- notifications: one row per delivered in-app message. read_at null = unread.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
-- The bell query: a member's notifications newest-first, with the unread filter cheap.
create index if not exists idx_notifications_inbox on public.notifications (profile_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (profile_id) where read_at is null;

alter table public.notifications enable row level security;

-- Read: the owner, or a coach in the same company (delivery audit).
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select
  using (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- Insert: members may create rows addressed to themselves (e.g. local marks); the service role
-- (createNotification) bypasses RLS to fan out to other members. Coaches may insert in-company.
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert
  with check (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- Update: only the owner (used to set read_at).
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Delete: only the owner.
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- push_subscriptions: one row per browser/device push endpoint. Strictly owner-scoped.
-- endpoint is globally unique so re-subscribing the same device upserts rather than duplicates.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_owner on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Owner-only on every operation. These are device secrets; no coach visibility.
drop policy if exists push_subscriptions_read on public.push_subscriptions;
create policy push_subscriptions_read on public.push_subscriptions for select
  using (profile_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete
  using (profile_id = auth.uid());
