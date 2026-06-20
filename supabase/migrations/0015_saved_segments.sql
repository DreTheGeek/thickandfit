-- 0015 Saved smart lists for the CRM. Stores a ClientFilters JSON definition a coach can
-- recall across sessions/devices. Built-in default segments are code-defined; only
-- user-created lists live here. scope lets the same table serve leads later.
create table public.saved_segments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  scope       text not null default 'client' check (scope in ('client','lead')),
  name        text not null,
  slug        text not null,
  definition  jsonb not null default '{}'::jsonb,
  color       text not null default '#0f0f0f',
  is_shared   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, slug)
);
alter table public.saved_segments enable row level security;
create index idx_saved_segments_company on public.saved_segments(company_id, scope);
create policy saved_segments_tenant on public.saved_segments using (company_id = public.current_company_id());
create trigger set_saved_segments_updated_at before update on public.saved_segments
  for each row execute function public.set_updated_at();
