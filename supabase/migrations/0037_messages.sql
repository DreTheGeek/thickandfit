-- 0037 PHASE 2 — Direct messages (client <-> coach inbox).
-- One thread per client: every row carries client_id (the subscriber the thread belongs to) and
-- sender_id (who wrote it; the client or any company coach). The coach inbox groups by client_id;
-- the subscriber sees their own thread. Realtime-enabled for live delivery. RLS: the owning client
-- and the company's coaches; you may only send AS yourself.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_messages_client on public.messages (client_id, created_at);
create index if not exists idx_messages_company on public.messages (company_id, created_at desc);

alter table public.messages enable row level security;
drop policy if exists messages_rw on public.messages;
create policy messages_rw on public.messages for all
  using (client_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (
    sender_id = auth.uid()
    and (client_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  );

-- Live delivery: add to the Realtime publication (idempotent guard for re-runs).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
