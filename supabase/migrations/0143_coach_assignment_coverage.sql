-- ---------------------------------------------------------------------------------------------
-- 0143: who owns this member, and who is covering while she is away.
--
-- WHAT THIS CLOSES. .planning/OPERATOR-GAPS.md, Part 4: "She cannot leave if she is the only person
-- who can do the work." The role model was already right — five roles including assistant_coach,
-- and requireApprover exists precisely so an assistant cannot approve their own draft. What was
-- missing was the delegation itself:
--
--   * No assignment. Every queue is company-wide. An assistant coach cannot be handed 40 clients
--     and held to them, because there is no way to say which 40.
--   * No coverage. Nothing can express "I am away until the 20th, route everything to Dani",
--     so the away state is an outage rather than a supported mode.
--
-- TWO COLUMNS AND ONE TABLE, not a workflow engine. Assignment is one nullable FK on the member;
-- coverage is a dated row saying one coach stands in for another. Everything else — which queue
-- shows what, who gets the notification — is a read over those two facts.
--
-- NULL assigned_coach_id IS NOT A BUG. It means "the company owns her", which is exactly the state
-- every one of the 256 migrating members is in today and a perfectly good permanent answer while
-- Stephanie is the only coach. The queues therefore default to showing everything and let a coach
-- narrow to her own; a default of "mine" would have shown an empty console on the day this shipped.
-- ---------------------------------------------------------------------------------------------

alter table public.profiles
  add column if not exists assigned_coach_id uuid references public.profiles(id) on delete set null;

comment on column public.profiles.assigned_coach_id is
  'The coach responsible for this member. NULL means the company owns her, which is the default and '
  'a valid permanent state. ON DELETE SET NULL rather than CASCADE: removing a coach must never '
  'delete her clients, it must hand them back to the company.';

-- Partial: the overwhelming majority of rows are NULL today and every query here asks for a
-- specific coach's members.
create index if not exists idx_profiles_assigned_coach
  on public.profiles (assigned_coach_id)
  where assigned_coach_id is not null;

-- ---------------------------------------------------------------------------------------------
create table if not exists public.coach_coverage (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  -- Who is away.
  coach_id           uuid not null references public.profiles(id) on delete cascade,
  -- Who is standing in. NOT NULL: "I am away and nobody is covering" is not coverage, it is an
  -- absence, and recording it here would make the resolver return nobody for a live queue.
  covering_coach_id  uuid not null references public.profiles(id) on delete cascade,
  starts_on          date not null,
  -- Inclusive. "Back on the 20th" is ends_on = the 19th; the UI does that conversion once so the
  -- date stored always means "the last day I am away".
  ends_on            date not null,
  note               text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint coach_coverage_dates_ordered check (ends_on >= starts_on),
  -- Covering yourself resolves to a one-step loop that changes nothing, and reads as a mistake on
  -- the screen. Rejected at the database so no UI has to remember.
  constraint coach_coverage_not_self check (covering_coach_id <> coach_id)
);

alter table public.coach_coverage enable row level security;

create index if not exists idx_coach_coverage_active
  on public.coach_coverage (company_id, coach_id, starts_on, ends_on);

-- Tenant-scoped from the start, and staff-only: coverage is an internal rota, not member-facing.
-- Written with the same predicate shape 0142 established, so the next audit run does not flag it.
create policy coach_coverage_staff on public.coach_coverage for all to authenticated
  using      (public.is_coach() and company_id = public.auth_company_id())
  with check (public.is_coach() and company_id = public.auth_company_id());

create trigger set_coach_coverage_updated_at before update on public.coach_coverage
  for each row execute function public.set_updated_at();

comment on table public.coach_coverage is
  'One coach standing in for another between two dates, inclusive. Resolved at read time by '
  'src/lib/coach/coverage-shared.ts, which follows at most a short chain and refuses to loop.';
