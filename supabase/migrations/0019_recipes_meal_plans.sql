-- 0019 Nutrition Library: recipes + recipe_books + recipe_ingredients + meal_plans (from Lenus).
-- Macros are precomputed at import and stored on the row so the browser never aggregates. Role-gated
-- to coach roles + WITH CHECK (consistent with the 0018 lockdown); the coach app reads via the
-- service client. company_id NOT NULL + RLS. No money columns (macros are grams/kcal).

create table public.recipe_books (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  lenus_id        text,
  name            text not null,
  slug            text not null,
  recipe_count    int not null default 0,
  cover_image_url text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, slug)
);
alter table public.recipe_books enable row level security;
create index idx_recipe_books_company on public.recipe_books(company_id);
create policy recipe_books_tenant on public.recipe_books
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
create trigger set_recipe_books_updated_at before update on public.recipe_books
  for each row execute function public.set_updated_at();

create table public.recipes (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  lenus_id            text,
  recipe_book_id      uuid references public.recipe_books(id) on delete set null,
  recipe_book_name    text,
  category            text,
  name_en             text not null,
  name_es             text,
  image_url           text,
  has_video           boolean not null default false,
  procedure_en        text,
  procedure_es        text,
  prep_time_minutes   int,
  cooking_time_minutes int,
  total_time_minutes  int generated always as (coalesce(prep_time_minutes, 0) + coalesce(cooking_time_minutes, 0)) stored,
  protein_g           numeric not null default 0,
  carb_g              numeric not null default 0,
  fat_g               numeric not null default 0,
  kcal                int not null default 0,
  ingredient_count    int not null default 0,
  search_text         text,
  spices              jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, lenus_id)
);
alter table public.recipes enable row level security;
create index idx_recipes_company on public.recipes(company_id);
create index idx_recipes_category on public.recipes(company_id, category);
create index idx_recipes_book on public.recipes(recipe_book_id);
create policy recipes_tenant on public.recipes
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
create trigger set_recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  lenus_food_id   text,
  ingredient_name text not null,
  amount_grams    numeric,
  unit_label      text,
  amount_print    text,
  protein_g       numeric not null default 0,
  carb_g          numeric not null default 0,
  fat_g           numeric not null default 0,
  kcal            int not null default 0,
  sequence        int not null default 0
);
alter table public.recipe_ingredients enable row level security;
create index idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id, sequence);
create index idx_recipe_ingredients_company on public.recipe_ingredients(company_id);
create policy recipe_ingredients_tenant on public.recipe_ingredients
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

create table public.meal_plans (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  lenus_id          text,
  contact_id        uuid references public.contacts(id) on delete set null,
  name              text not null,
  is_template       boolean not null default false,
  calorie_goal      int,
  split_protein_pct int,
  split_carb_pct    int,
  split_fat_pct     int,
  macro_timing_name text,
  num_meal_groups   int,
  protein_g         int generated always as (round(calorie_goal * split_protein_pct / 100.0 / 4.0)) stored,
  carb_g            int generated always as (round(calorie_goal * split_carb_pct / 100.0 / 4.0)) stored,
  fat_g             int generated always as (round(calorie_goal * split_fat_pct / 100.0 / 9.0)) stored,
  plan_jsonb        jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, lenus_id)
);
alter table public.meal_plans enable row level security;
create index idx_meal_plans_company on public.meal_plans(company_id, is_template);
create index idx_meal_plans_contact on public.meal_plans(contact_id);
create policy meal_plans_tenant on public.meal_plans
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());
create trigger set_meal_plans_updated_at before update on public.meal_plans
  for each row execute function public.set_updated_at();
