-- PRD-09: 5-context equipment substitution chains with reason tags.
create type substitution_context as enum ('gym', 'bodyweight', 'bands', 'freeweights', 'machines');

create table public.substitution_reason_tags ( -- KALDR:GLOBAL
  key       text primary key,
  label_en  text not null,
  label_es  text
);
alter table public.substitution_reason_tags enable row level security;
create policy reason_tags_read on public.substitution_reason_tags for select using (true);
insert into public.substitution_reason_tags (key, label_en, label_es) values
  ('knee_pain','Knee pain','Dolor de rodilla'),
  ('machine_unavailable','Machine unavailable','Máquina no disponible'),
  ('make_easier','Make easier','Hacerlo más fácil'),
  ('make_harder','Make harder','Hacerlo más difícil'),
  ('equipment_swap','Equipment swap','Cambio de equipo')
on conflict (key) do nothing;

create table public.exercise_substitutions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  exercise_id            uuid not null references public.exercises(id) on delete cascade,
  substitute_exercise_id uuid not null references public.exercises(id) on delete cascade,
  context                substitution_context not null,
  reason_tag             text references public.substitution_reason_tags(key),
  sort_order             int not null default 0,
  created_at             timestamptz not null default now()
);
alter table public.exercise_substitutions enable row level security;
create index idx_subs_lookup on public.exercise_substitutions(exercise_id, context, sort_order);
create index idx_subs_company on public.exercise_substitutions(company_id);
create policy subs_tenant on public.exercise_substitutions using (company_id = public.current_company_id());
