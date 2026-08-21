-- Who put this member on this plan: a coach, or the software.
--
-- TWO THINGS BOTH NEEDED THIS COLUMN and neither could be answered without it.
--
-- 1. The Getting started checklist scopes "Give somebody a program" to the coach who did it, so a
--    new assistant coach does not inherit Stephanie's tick and get told she has already learned
--    something she has never done. It was querying plan_assignments.created_by, which did not
--    exist. Supabase returns an error, the call site reads it as zero, and the step would have sat
--    permanently unticked for everybody. Nothing throws. This is the third time in this codebase a
--    wrong column name has produced a silent, permanent, plausible-looking zero.
--
-- 2. The member-facing copy on /workouts has to know whether a HUMAN chose her program. "Steph
--    writes your plan by hand, she will message you when it is ready" is true when a coach assigns
--    it and a half-truth when the matcher does. That was decided by comparing the plan id against
--    STARTER_PROGRAM_ID, which stops working the moment the matcher can assign without that env
--    var being set - which is now.
--
-- NULL MEANS AUTOMATIC. Not a default of "system", because a null is honest about the 2 rows that
-- already exist and whose author nobody recorded: they were auto-assigned by STARTER_PROGRAM_ID, so
-- null is not merely a safe backfill, it is the correct one.
alter table public.plan_assignments
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null;

comment on column public.plan_assignments.assigned_by is
  'The coach who assigned this plan. NULL means the software chose it (auto-assign at onboarding), which is what the member-facing copy on /workouts keys off.';

-- Reading "which of my clients did I put on a program" per coach, and "was this one automatic".
create index if not exists plan_assignments_assigned_by_idx
  on public.plan_assignments (company_id, assigned_by);
