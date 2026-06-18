-- PRD-08: exercise library. exercises.company_id is NULL for the shared system seed,
-- or a company for per-coach custom exercises. Lookups are KALDR:GLOBAL.

create table public.muscle_groups ( -- KALDR:GLOBAL
  key       text primary key,
  label_en  text not null,
  label_es  text
);
alter table public.muscle_groups enable row level security;
create policy muscle_groups_read on public.muscle_groups for select using (true);
insert into public.muscle_groups (key, label_en, label_es) values
  ('abdominals','Abs','Abdominales'),('abductors','Abductors','Abductores'),('adductors','Adductors','Aductores'),
  ('biceps','Biceps','Bíceps'),('calves','Calves','Pantorrillas'),('chest','Chest','Pecho'),
  ('forearms','Forearms','Antebrazos'),('glutes','Glutes','Glúteos'),('hamstrings','Hamstrings','Isquiotibiales'),
  ('lats','Lats','Dorsales'),('lower back','Lower back','Zona lumbar'),('middle back','Middle back','Espalda media'),
  ('neck','Neck','Cuello'),('quadriceps','Quads','Cuádriceps'),('shoulders','Shoulders','Hombros'),
  ('traps','Traps','Trapecios'),('triceps','Triceps','Tríceps')
on conflict (key) do nothing;

create table public.exercise_equipment_types ( -- KALDR:GLOBAL
  key       text primary key,
  label_en  text not null,
  label_es  text
);
alter table public.exercise_equipment_types enable row level security;
create policy equipment_read on public.exercise_equipment_types for select using (true);
insert into public.exercise_equipment_types (key, label_en, label_es) values
  ('body only','Bodyweight','Peso corporal'),('barbell','Barbell','Barra'),('dumbbell','Dumbbell','Mancuerna'),
  ('machine','Machine','Máquina'),('cable','Cable','Polea'),('kettlebells','Kettlebell','Pesa rusa'),
  ('bands','Bands','Bandas'),('medicine ball','Medicine ball','Balón medicinal'),
  ('exercise ball','Exercise ball','Pelota de ejercicio'),('e-z curl bar','EZ curl bar','Barra Z'),
  ('foam roll','Foam roller','Rodillo'),('other','Other','Otro')
on conflict (key) do nothing;

create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade, -- NULL = shared system seed
  name_en      text not null,
  name_es      text,
  cues_en      text,
  cues_es      text,
  muscle_group text,
  equipment    text,
  difficulty   text check (difficulty is null or difficulty in ('beginner','intermediate','expert')),
  category     text,
  video_mux_id text,
  is_own_demo  boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.exercises enable row level security;
create index idx_exercises_muscle on public.exercises(muscle_group);
create index idx_exercises_equipment on public.exercises(equipment);
create index idx_exercises_company on public.exercises(company_id);
-- System seed (company_id NULL) is readable by everyone; company customs scoped to the company.
create policy exercises_read on public.exercises for select
  using (company_id is null or company_id = public.current_company_id());
create policy exercises_company_write on public.exercises for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
