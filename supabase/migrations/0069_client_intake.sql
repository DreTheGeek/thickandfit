-- 0069 -- Client intake / health profile. The one Lenus data class with no home in the app: the
-- onboarding questionnaire + health assessment a coach relies on (goal direction + target, injuries
-- and medical conditions, dietary exclusions, eating-disorder + sleep screening, training history,
-- bad habits, BMR + calorie goal). Without this, Stephanie would have to re-ask every migrated
-- client for information they already gave Lenus. Keyed to the CRM contact (legacy clients exist as
-- contacts before they claim an app profile); profile_id is linked when the client claims their
-- account. Structured columns for the fields the app queries + a full-fidelity `raw` jsonb so NOTHING
-- from the source questionnaire is ever dropped. Company-scoped + RLS (coach read/write, owner reads
-- own once claimed); the importer writes via the service client per the service-everywhere pattern.

create table if not exists public.client_intake (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  -- demographics
  sex                     text,
  birth_date              date,
  height_cm               numeric,
  starting_weight_kg      numeric,
  -- goal
  goal_type               text,      -- deficit | surplus | maintain
  target_weight_kg        numeric,
  goal_intensity          numeric,
  bmr                     numeric,
  calorie_goal_kcal       numeric,
  -- health + preferences
  injuries                text[],
  injuries_description    text,
  medical_conditions      text,
  dietary_exclusions      text[],
  allergies               text,
  training_experience     text,
  bad_habits              text,
  activity_level          text,
  -- full screenings kept whole (never flattened away)
  eating_disorder_screening jsonb,
  sleep_assessment          jsonb,
  custom_fields             jsonb,   -- coach custom questions + the client's free-text answers
  -- full fidelity: the entire source questionnaire payload, so nothing is ever lost
  raw                     jsonb,
  source                  text not null default 'lenus',
  questionnaire_filled_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (company_id, contact_id)
);

create index if not exists idx_client_intake_contact on public.client_intake (company_id, contact_id);
create index if not exists idx_client_intake_profile on public.client_intake (profile_id) where profile_id is not null;

alter table public.client_intake enable row level security;

-- Coaches / assistant coaches / operators of the company read + write (is_coach() covers assistant).
drop policy if exists client_intake_coach_rw on public.client_intake;
create policy client_intake_coach_rw on public.client_intake for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- The owner (once their contact is claimed to a profile) may read their own intake.
drop policy if exists client_intake_owner_read on public.client_intake;
create policy client_intake_owner_read on public.client_intake for select
  using (company_id = public.current_company_id() and profile_id = auth.uid());

comment on table public.client_intake is
  'Per-client onboarding questionnaire + health assessment (migrated from Lenus). The home for goal, '
  'injuries, medical conditions, dietary exclusions, screenings, and training history so a coach never '
  'has to re-ask a migrated client. raw holds the full source payload for anything not columnized.';
