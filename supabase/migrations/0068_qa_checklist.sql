-- 0068 PHASE 2 -- Operator QA checklist (the launch bug-test board). Lives in the OPERATOR portal
-- (/admin) so Stephanie's coach view stays clean; her QA team works this list while a second tester
-- drives the client portal. Items are seeded by .qa-visual/seed-qa-checklist.cjs (idempotent).
create table if not exists public.qa_checklist (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  category    text not null,               -- Brand, Auth, Paywall, Scan, Gamification, ...
  title       text not null,               -- the one-line check
  detail      text,                        -- HOW to test + the expected result
  status      text not null default 'todo' check (status in ('todo', 'pass', 'fail', 'blocked')),
  notes       text,                        -- tester notes / bug repro
  checked_by  text,                        -- tester email/name
  checked_at  timestamptz,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_qa_checklist_company on public.qa_checklist (company_id, category, sort);

alter table public.qa_checklist enable row level security;

-- Coach-family RLS (the /admin PAGE further restricts to operators); subscribers read zero rows.
drop policy if exists qa_checklist_rw on public.qa_checklist;
create policy qa_checklist_rw on public.qa_checklist for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

create trigger set_qa_checklist_updated_at before update on public.qa_checklist
  for each row execute function public.set_updated_at();
