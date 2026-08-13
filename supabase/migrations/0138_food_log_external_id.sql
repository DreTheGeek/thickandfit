-- A source id on food_log, so the Lenus food diary can be re-synced instead of re-duplicated.
--
-- food_log has no unique key beyond its own uuid primary key, so nothing distinguishes "the same
-- entry, fetched again" from "a second helping". The 6,924 rows imported in July carry no source
-- id at all, which is why the August sweep had to prove itself a strict superset by matching on
-- (contact, day, name, kcal) before the importer was allowed to replace them.
--
-- With this column the next run is an upsert and that proof is no longer needed.
--
-- Partial on external_id is not null: a member logging her lunch in this app has no Lenus id and
-- must never collide with one.

alter table public.food_log
  add column if not exists external_id text;

create unique index if not exists idx_food_log_external
  on public.food_log (company_id, external_id)
  where external_id is not null;

comment on column public.food_log.external_id is
  'Lenus foodDiary entry id for migrated rows. Null for anything logged in this app. Two entries can share a day, a name and a calorie count legitimately (the same food twice), so this is the only safe key.';
