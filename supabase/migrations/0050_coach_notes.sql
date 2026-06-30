-- 0050 PHASE 2 -- Coach notes. Coaches can record free-text notes on a subscriber (profile) or a CRM
-- client (contact). The "Coach Notes" panel on the subscriber profile previously always showed an empty
-- placeholder with no way to add one. Company-scoped + coach-gated (RLS backstop; the app reads/writes
-- via the service client per the service-everywhere pattern). Soft-delete via deleted_at.

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subject_type text not null check (subject_type in ('profile', 'contact')),
  subject_id uuid not null,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_coach_notes_subject
  on public.coach_notes (company_id, subject_type, subject_id, created_at desc)
  where deleted_at is null;

alter table public.coach_notes enable row level security;

-- Coaches / assistant_coaches / operators of the company read + write notes (is_coach() includes assistant).
create policy coach_notes_read on public.coach_notes for select
  using (company_id = public.current_company_id() and public.is_coach());
create policy coach_notes_insert on public.coach_notes for insert
  with check (company_id = public.current_company_id() and public.is_coach() and author_id = auth.uid());
create policy coach_notes_update on public.coach_notes for update
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
