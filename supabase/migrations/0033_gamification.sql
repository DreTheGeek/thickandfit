-- 0033 PHASE 2: Gamification (streaks + badges).
-- Three tables:
--   user_streaks   one row per member, the live streak state (current/longest/freeze tokens)
--   badges         shared catalog of earnable badges (bilingual copy + threshold + kind)
--   user_badges    join: which member earned which badge, when (idempotent via unique index)
-- All company-scoped. RLS:
--   user_streaks   owner-or-coach (a member sees only their own; coaches audit any in-company)
--   badges         shared read (the catalog is the same for everyone in the company)
--   user_badges    owner-or-coach
-- The service role (recompute + award engine in src/lib/gamification) bypasses RLS to write.

-- ---------------------------------------------------------------------------------------------
-- user_streaks: the live streak state. last_active_on is the most recent day with ANY activity
-- (a workout completion, a food log, or a weight entry). freeze_tokens bridge one missed day.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_streaks (
  profile_id     uuid primary key references public.profiles(id) on delete cascade,
  company_id     uuid not null,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_on date,
  freeze_tokens  int not null default 0,
  updated_at     timestamptz not null default now()
);
create index if not exists idx_user_streaks_company on public.user_streaks (company_id);

alter table public.user_streaks enable row level security;

-- Read: owner, or a coach in the same company.
drop policy if exists user_streaks_read on public.user_streaks;
create policy user_streaks_read on public.user_streaks for select
  using (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- Write paths run as the service role (BYPASSRLS). We still allow the owner to insert/update
-- their own row so a future client-side optimistic write is possible without a policy change.
drop policy if exists user_streaks_insert on public.user_streaks;
create policy user_streaks_insert on public.user_streaks for insert
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

drop policy if exists user_streaks_update on public.user_streaks;
create policy user_streaks_update on public.user_streaks for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- badges: the shared catalog. key is the stable code the award engine branches on. kind groups
-- badges so the engine knows which counter a threshold compares against:
--   workout  -> total workout-completion days
--   logging  -> total food-logging days
--   streak   -> current/longest streak length in days
--   weight   -> lbs moved toward goal (milestone)
--   misc     -> one-off (first action) handled by threshold=1 of its kind
-- ---------------------------------------------------------------------------------------------
create table if not exists public.badges (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name_en        text not null,
  name_es        text not null,
  description_en text not null,
  description_es text not null,
  icon           text not null,           -- emoji glyph rendered in the grid
  threshold      int not null,
  kind           text not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

alter table public.badges enable row level security;

-- Shared read: any authenticated member may read the catalog. No client writes (service role seeds).
drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------------------------
-- user_badges: which member earned which badge. Unique (profile_id, badge_id) makes awarding
-- idempotent. company_id carried for tenant scope.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  unique (profile_id, badge_id)
);
create index if not exists idx_user_badges_owner on public.user_badges (profile_id, earned_at desc);

alter table public.user_badges enable row level security;

-- Read: owner, or a coach in the same company.
drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges for select
  using (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- Insert: owner may insert their own (the award engine uses the service role). Coaches may grant.
drop policy if exists user_badges_insert on public.user_badges;
create policy user_badges_insert on public.user_badges for insert
  with check (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- ---------------------------------------------------------------------------------------------
-- Seed the badge catalog (~10). idempotent on key. Stephanie's copy is intentionally warm.
-- weight badges store lbs-toward-goal in threshold; the engine compares abs(lbs moved).
-- ---------------------------------------------------------------------------------------------
insert into public.badges (key, name_en, name_es, description_en, description_es, icon, threshold, kind, sort_order)
values
  ('first_workout', 'First Sweat',  'Primer Sudor',
   'Completed your very first workout.', 'Completaste tu primer entrenamiento.',
   '🔥', 1, 'workout', 10),
  ('workouts_10', '10 Workouts', '10 Entrenamientos',
   'Logged 10 workout days. Consistency is showing.', 'Registraste 10 dias de entrenamiento. La constancia se nota.',
   '💪', 10, 'workout', 20),
  ('workouts_50', '50 Workouts', '50 Entrenamientos',
   'Fifty workout days in the books. Unstoppable.', 'Cincuenta dias de entrenamiento. Imparable.',
   '🏋️', 50, 'workout', 30),
  ('streak_7', '7-Day Streak', 'Racha de 7 Dias',
   'Active seven days in a row.', 'Activa siete dias seguidos.',
   '🌟', 7, 'streak', 40),
  ('streak_30', '30-Day Streak', 'Racha de 30 Dias',
   'A full month of daily activity.', 'Un mes completo de actividad diaria.',
   '📅', 30, 'streak', 50),
  ('streak_100', '100-Day Streak', 'Racha de 100 Dias',
   'One hundred days strong. Legendary.', 'Cien dias seguidos. Legendaria.',
   '👑', 100, 'streak', 60),
  ('first_meal', 'First Meal Logged', 'Primera Comida',
   'Logged your first meal.', 'Registraste tu primera comida.',
   '🥗', 1, 'logging', 70),
  ('logging_7', '7-Day Logger', 'Registro de 7 Dias',
   'Logged food seven days. Awareness is the win.', 'Registraste comida siete dias. La conciencia es la victoria.',
   '📝', 7, 'logging', 80),
  ('logging_30', '30-Day Logger', 'Registro de 30 Dias',
   'Thirty days of food logging.', 'Treinta dias registrando comida.',
   '📒', 30, 'logging', 90),
  ('weight_5', 'First 5 lbs', 'Primeras 5 Libras',
   'Moved 5 lbs toward your goal.', 'Avanzaste 5 libras hacia tu meta.',
   '⚖️', 5, 'weight', 100),
  ('weight_15', '15 lbs Milestone', 'Meta de 15 Libras',
   'Moved 15 lbs toward your goal.', 'Avanzaste 15 libras hacia tu meta.',
   '🎯', 15, 'weight', 110)
on conflict (key) do nothing;
