-- 0075 -- Operator/admin portal backing tables: support tickets + portal settings (support hours,
-- maintenance window, etc). Operator-only writes; RLS scopes to the company + gates behind the
-- operator role via a helper. Helper is defined FIRST so the policies below can reference it.

-- profile_role(): the caller's role from their profile. Named to avoid the Postgres built-in
-- current_role. SECURITY DEFINER so the policy can read profiles regardless of the caller's own RLS.
create or replace function public.profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- Support tickets: raised by members (via a support form / email intake) and worked by operators.
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null, -- who raised it (if a member)
  email         text,
  subject       text not null,
  body          text,
  category      text,                                                   -- billing | bug | account | other
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status        text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  assigned_to   uuid references public.profiles(id) on delete set null,
  source        text not null default 'app',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists idx_support_tickets_status on public.support_tickets (company_id, status, created_at desc);

alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_operator on public.support_tickets;
create policy support_tickets_operator on public.support_tickets for all
  using (company_id = public.current_company_id() and public.profile_role() = 'operator')
  with check (company_id = public.current_company_id() and public.profile_role() = 'operator');
drop policy if exists support_tickets_owner_read on public.support_tickets;
create policy support_tickets_owner_read on public.support_tickets for select
  using (company_id = public.current_company_id() and profile_id = auth.uid());
drop policy if exists support_tickets_owner_insert on public.support_tickets;
create policy support_tickets_owner_insert on public.support_tickets for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

-- Portal settings: one row per company the operator edits (support hours, notices).
create table if not exists public.admin_settings (
  company_id       uuid primary key references public.companies(id) on delete cascade,
  support_hours    text,
  support_email    text,
  support_phone    text,
  maintenance_note text,
  updated_at       timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
drop policy if exists admin_settings_operator on public.admin_settings;
create policy admin_settings_operator on public.admin_settings for all
  using (company_id = public.current_company_id() and public.profile_role() = 'operator')
  with check (company_id = public.current_company_id() and public.profile_role() = 'operator');
