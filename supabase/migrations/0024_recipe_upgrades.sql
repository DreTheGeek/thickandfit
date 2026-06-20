-- 0024 Recipe upgrades: serving scaling, quality score, ingredient confidence, source video,
-- and per-subscriber favorites. Additive to the 0019 recipe library + 158 Lenus recipes.
--
-- recipes gains: servings (for the 0.5x-4x scaler baseline), source_url / creator_handle /
--   video_url (provenance + embedded source video), quality_score (0-100 completeness band).
-- recipe_ingredients gains: confidence (0-1, drives the per-ingredient confidence dots) and
--   is_verified (coach-confirmed match). Both backfilled with sensible defaults for the Lenus rows.
-- recipe_favorites is profile-scoped (auth.uid()) so each subscriber/coach favorites independently.

-- 1. recipes: scaling + provenance + quality
alter table public.recipes
  add column if not exists servings       int  not null default 1,
  add column if not exists source_url      text,
  add column if not exists creator_handle  text,
  add column if not exists video_url       text,
  add column if not exists quality_score   int  not null default 0;

-- 2. recipe_ingredients: confidence + verification
alter table public.recipe_ingredients
  add column if not exists confidence  numeric not null default 0.5,
  add column if not exists is_verified boolean not null default false;

-- 3. has_video should reflect a present source video going forward (trigger keeps it in sync).
create or replace function public.sync_recipe_has_video()
returns trigger
language plpgsql
as $$
begin
  new.has_video := new.video_url is not null and length(trim(new.video_url)) > 0;
  return new;
end;
$$;

drop trigger if exists sync_recipe_has_video on public.recipes;
create trigger sync_recipe_has_video before insert or update of video_url on public.recipes
  for each row execute function public.sync_recipe_has_video();

-- 4. recipe_favorites: one row per (profile, recipe). Subscriber-scoped via auth.uid(); coaches
--    may also read/write their own. company_id pinned for tenancy + RLS consistency.
create table if not exists public.recipe_favorites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, recipe_id)
);
alter table public.recipe_favorites enable row level security;
create index if not exists idx_recipe_favorites_profile on public.recipe_favorites(profile_id);
create index if not exists idx_recipe_favorites_recipe on public.recipe_favorites(recipe_id);
drop policy if exists recipe_favorites_owner on public.recipe_favorites;
create policy recipe_favorites_owner on public.recipe_favorites
  using (profile_id = auth.uid() and company_id = public.current_company_id())
  with check (profile_id = auth.uid() and company_id = public.current_company_id());

-- 5. Backfill the 158 Lenus recipes.
--    servings: Lenus macros are stored per-recipe (already a single serving) -> 1.
update public.recipes set servings = 1 where servings is null or servings = 0;

--    quality_score: completeness heuristic (0-100) from the data we do have.
--    image(20) + procedure(25) + has any ingredients(25) + has time(10) + all ingredients have kcal(20)
update public.recipes r set quality_score = (
    (case when r.image_url is not null then 20 else 0 end)
  + (case when coalesce(r.procedure_en, r.procedure_es) is not null then 25 else 0 end)
  + (case when r.ingredient_count > 0 then 25 else 0 end)
  + (case when r.total_time_minutes > 0 then 10 else 0 end)
  + (case when not exists (
        select 1 from public.recipe_ingredients ri
        where ri.recipe_id = r.id and (ri.kcal is null or ri.kcal = 0)
      ) and r.ingredient_count > 0 then 20 else 0 end)
);

--    ingredient confidence: a matched Lenus food id + a real gram amount is a confident match.
update public.recipe_ingredients
  set confidence = case
        when lenus_food_id is not null and amount_grams is not null and amount_grams > 0 and kcal > 0 then 0.9
        when lenus_food_id is not null and amount_grams is not null and amount_grams > 0 then 0.7
        when amount_grams is not null and amount_grams > 0 then 0.5
        else 0.3
      end,
      is_verified = (lenus_food_id is not null and amount_grams is not null and amount_grams > 0 and kcal > 0);
