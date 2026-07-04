-- 0076 -- Organize the launch QA board by phase (build/launch priority order) + assign a tester per
-- item (Rodney / LaSean / Shakira), plus structured what-to-do fields so each row is extreme-detail:
-- what the app SHOULD do, how to TRIGGER it, and the EXPECTED result. detail stays as a fallback blob.
alter table public.qa_checklist add column if not exists phase text;               -- e.g. 'Phase 1: Access & Payments'
alter table public.qa_checklist add column if not exists phase_order int not null default 99;
alter table public.qa_checklist add column if not exists assigned_tester text;      -- Rodney | LaSean | Shakira
alter table public.qa_checklist add column if not exists area text;                 -- functional area within a phase
alter table public.qa_checklist add column if not exists should_do text;            -- exact expected look/behavior
alter table public.qa_checklist add column if not exists how_to_trigger text;       -- precise steps to exercise it
alter table public.qa_checklist add column if not exists expected_result text;      -- what success looks like
alter table public.qa_checklist add column if not exists involves_ghl boolean not null default false;

create index if not exists idx_qa_checklist_phase on public.qa_checklist (company_id, phase_order, area, sort);
