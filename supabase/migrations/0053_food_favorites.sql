-- 0053 PHASE 2 -- Favorite foods. A member stars foods they eat often for one-tap re-log (distinct
-- from auto "recents"). Owner-scoped; company-scoped like everything else.

create table if not exists public.user_food_favorites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, food_id)
);

create index if not exists idx_user_food_favorites_member
  on public.user_food_favorites (profile_id, created_at desc);

alter table public.user_food_favorites enable row level security;

create policy uff_select on public.user_food_favorites for select
  using (profile_id = auth.uid() and company_id = public.current_company_id());
create policy uff_insert on public.user_food_favorites for insert
  with check (profile_id = auth.uid() and company_id = public.current_company_id());
create policy uff_delete on public.user_food_favorites for delete
  using (profile_id = auth.uid() and company_id = public.current_company_id());
