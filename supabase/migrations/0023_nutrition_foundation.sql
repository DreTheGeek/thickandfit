-- 0023 PHASE 2 — Nutrition engine foundation (the headline differentiator).
-- Atomic food entity + portions + cooked/uncooked ratios + the client food diary. Everything
-- (manual logging, barcode, photo-to-macro, recipe scaling) reads/writes these tables.
-- foods is a shared corpus: company_id NULL = system/USDA/OFF seed, mirroring the exercises pattern.

create extension if not exists vector;

-- ---------------------------------------------------------------------------------------------
-- foods: per-100g nutrition authority (USDA FoodData Central + Open Food Facts + coach overrides)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,                              -- NULL = shared corpus (system/USDA/OFF)
  source text not null default 'usda',          -- usda | off | coach_override | ai_estimate
  source_id text,                               -- provenance: external id
  source_url text,
  name_en text not null,
  name_es text,
  brand text,
  barcode text,
  category text,
  -- all macros per 100 g (edible portion)
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  sugar_g numeric,
  fat_g numeric not null default 0,
  sat_fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  density_g_per_ml numeric,                      -- turns volume (cups/ml) into grams
  is_verified boolean not null default false,
  confidence numeric,                           -- 0..1 for ai_estimate rows
  embedding vector(1536),                        -- name embedding for photo-to-macro match
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_foods_company on public.foods (company_id);
create index if not exists idx_foods_barcode on public.foods (barcode) where barcode is not null;
create index if not exists idx_foods_category on public.foods (category);
create index if not exists idx_foods_fts on public.foods using gin (to_tsvector('simple', coalesce(search_text, name_en)));
create index if not exists idx_foods_embedding on public.foods using hnsw (embedding vector_cosine_ops);

alter table public.foods enable row level security;
drop policy if exists foods_read on public.foods;
create policy foods_read on public.foods for select
  using (company_id is null or company_id = public.current_company_id());
drop policy if exists foods_company_write on public.foods;
create policy foods_company_write on public.foods for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- ---------------------------------------------------------------------------------------------
-- food_portions: named household measures -> grams (e.g. "1 cup cooked" = 158 g)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods(id) on delete cascade,
  label_en text not null,
  label_es text,
  grams numeric not null,
  is_cooked boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_food_portions_food on public.food_portions (food_id);
alter table public.food_portions enable row level security;
drop policy if exists food_portions_read on public.food_portions;
create policy food_portions_read on public.food_portions for select using (true);

-- ---------------------------------------------------------------------------------------------
-- cooked_uncooked_ratios: deterministic weight-yield factors (USDA Cooking Yields R2 +
-- Nutrient Retention R6). cooked = raw * factor. Never AI-guessed; cited per row.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.cooked_uncooked_ratios (
  id uuid primary key default gen_random_uuid(),
  food_id uuid references public.foods(id) on delete cascade,
  category text,                                -- applies by category when food_id is null
  state_from text not null default 'raw',
  state_to text not null default 'cooked',
  factor numeric not null,                      -- weight multiplier raw->cooked
  usda_source text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ratios_food on public.cooked_uncooked_ratios (food_id);
create index if not exists idx_ratios_category on public.cooked_uncooked_ratios (category);
alter table public.cooked_uncooked_ratios enable row level security;
drop policy if exists ratios_read on public.cooked_uncooked_ratios;
create policy ratios_read on public.cooked_uncooked_ratios for select using (true);

-- ---------------------------------------------------------------------------------------------
-- food_log: the client diary. One row per logged item; macros snapshotted for fast day rollups.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.food_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid,                              -- the subscriber who logged it
  contact_id uuid references public.contacts(id) on delete cascade,
  logged_at timestamptz not null default now(),
  log_date date not null default (now() at time zone 'utc')::date,
  source text not null default 'manual',         -- search | barcode | photo | recipe | manual
  name text,                                    -- display-name snapshot (history survives food renames)
  food_id uuid references public.foods(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  portion_id uuid references public.food_portions(id) on delete set null,
  meal_slot text,                               -- breakfast | lunch | dinner | snack
  amount numeric,
  grams numeric,
  -- denormalized snapshot (so a day total never re-derives from joins)
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_food_log_day on public.food_log (company_id, contact_id, log_date);
create index if not exists idx_food_log_profile on public.food_log (profile_id, log_date);
alter table public.food_log enable row level security;
drop policy if exists food_log_rw on public.food_log;
create policy food_log_rw on public.food_log for all
  using (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()))
  with check (profile_id = auth.uid() or (company_id = public.current_company_id() and public.is_coach()));
