-- 0059 PHASE 2 -- Coach Interview (call 2026-07-02: "build a questionnaire so we can build the knowledge
-- base"). A guided intake where Stephanie (or her assistant Dani) answers multiple-choice, open-ended,
-- and scenario questions about how she coaches. Each saved answer is composed + ingested into
-- coach_knowledge (0040) so the AI coach + meal-plan generator ground in her real method - the point is
-- to capture her brain ONCE so the AI (or Dani) can coach AS her without needing Stephanie day to day.
--
-- One row per question (upsert on answer). answer holds text/scenario prose, a single choice string, or
-- a JSON array (for multi-select). company-scoped, coach-only RLS (same shape as coach_knowledge).
create table if not exists public.coach_interview_answers (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  section      text not null,                       -- section key (philosophy | nutrition | ...)
  question_key text not null,                       -- stable question id from the bank
  answer       text,                                -- prose, choice string, or JSON array (multi)
  answered_by  uuid,                                -- coach/assistant profile id who answered
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, question_key)
);

create index if not exists idx_coach_interview_company on public.coach_interview_answers (company_id, section);

alter table public.coach_interview_answers enable row level security;

-- Coaches (coach / assistant_coach / operator, via is_coach) manage their company's interview; nobody
-- else touches it. Reads/writes go through the service client in coach-guarded server actions; this
-- policy keeps a direct subscriber read at zero rows (matches the RLS isolation test's expectation).
drop policy if exists coach_interview_rw on public.coach_interview_answers;
create policy coach_interview_rw on public.coach_interview_answers for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

create trigger set_coach_interview_updated_at before update on public.coach_interview_answers
  for each row execute function public.set_updated_at();
