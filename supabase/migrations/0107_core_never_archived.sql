-- A movement on the filming shot list is never archived.
--
-- WHAT WENT WRONG. Pass 1 (0105) ran before is_core existed, so its "expert difficulty" rule had
-- nothing to check against and archived two shot-list movements: Front Barbell Squat (shot 17) and
-- Hanging Leg Raise (shot 44). Both are tagged `expert` in the imported dataset, which is simply
-- wrong: a front squat and a hanging leg raise are standard intermediate work, and the tag is an
-- artifact of a general bodybuilding catalog, not a judgement about this audience.
--
-- Pass 2 (0106) had the protection and honoured it. Only the rows pass 1 had already taken were
-- affected, which is why this is a correction rather than a redesign.
--
-- The trigger makes it structural. Curation will be run again, by someone who has not read 0105, and
-- "remember to check is_core" is not a mechanism.

-- 1. Put the two back, and anything else in the same state.
update public.exercises
set archived_at = null, archive_reason = null, archived_by = null
where is_core and archived_at is not null;

-- 2. Correct the difficulty that caused it. These are not expert movements for this audience, and
--    leaving the tag wrong means the next rule that reads difficulty makes the same mistake.
update public.exercises set difficulty = 'intermediate'
where is_core and difficulty = 'expert';

-- 3. Make it impossible to repeat.
create or replace function public.exercises_protect_core()
returns trigger
language plpgsql
as $function$
begin
  if new.archived_at is not null and new.is_core then
    raise exception
      'refusing to archive "%": it is on the filming shot list (is_core). Clear is_core first if it really should go.',
      new.name_en;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_exercises_protect_core on public.exercises;
create trigger trg_exercises_protect_core
  before update of archived_at on public.exercises
  for each row execute function public.exercises_protect_core();

comment on function public.exercises_protect_core() is
  'Blocks archiving a shot-list movement. Pass 1 of the 2026-08 curation archived two of them before is_core existed; this is the mechanism that replaces remembering.';
