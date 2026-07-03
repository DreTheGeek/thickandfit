-- 0067 PHASE 2 -- Close the check-then-insert races in food grounding (bug-hunt round 2).
-- Two concurrent scans of the same unknown food each passed the existence check, then both inserted,
-- silently growing duplicate corpus rows. App code alone cannot close a check-then-insert race; these
-- partial unique indexes are the load-bearing fix (verified 0 existing duplicates before creation).
-- USDA/OFF grounded rows carry (source, source_id); label-transcribed rows are source='ai' keyed by name.
create unique index if not exists uq_foods_source_id
  on public.foods (source, source_id)
  where source_id is not null;

create unique index if not exists uq_foods_ai_name
  on public.foods (lower(name_en))
  where source = 'ai';
