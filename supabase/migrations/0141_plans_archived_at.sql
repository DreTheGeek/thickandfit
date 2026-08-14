-- 0141: archive a program instead of deleting it.
--
-- On 2026-08-13 Stephanie went through her library and said which programs to drop: "we can delete
-- them, I don't even train the same" (the 6-week ones), plus the membership programs. That is 17 of
-- her 40 by name, authorised verbally on a call.
--
-- WHY NOT DELETE, when delete is what she said. plan_assignments references these rows, and several
-- clients are mid-program on plans she is about to stop using. A hard delete either cascades their
-- assignment away or fails on the constraint, and the version that "works" is the one that silently
-- removes a woman's current programming. It also cannot be undone from a phone call, and this
-- request arrived as one sentence in a 45-minute conversation.
--
-- Archived means: gone from the library she picks from, still readable everywhere it is already in
-- use. That is what she actually wants — she is decluttering a picker, not erasing history.

alter table public.plans
  add column if not exists archived_at timestamptz;

-- The library query orders by name within a company; archived rows are excluded at read time rather
-- than by a partial index, because the same table still serves lookups BY ID for live assignments.
create index if not exists idx_plans_company_active
  on public.plans (company_id, name_en)
  where archived_at is null;

comment on column public.plans.archived_at is
  'Set to hide a plan from the coach library and pickers. NEVER delete a plan: plan_assignments '
  'references it and a member may be mid-program. Archived plans still resolve by id everywhere '
  'they are already assigned.';
