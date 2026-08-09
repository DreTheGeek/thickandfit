-- Coach settings: the two preference screens Stephanie ran her business from on the old platform,
-- rebuilt here. "Client App Experience" (what her clients can do and see) and "Coaching Preferences"
-- (her defaults for meal plans, training plans, engagement and onboarding).
--
-- ONE ROW PER COMPANY, and company_id IS the primary key. These are not per-coach preferences: when
-- Stephanie turns off check-ins, Daniela must not see a different app than the clients do. A
-- per-profile table would let the assistant coach and the coach disagree about what the member-facing
-- app is allowed to do, and the member would get whichever row the request happened to read.
--
-- WHY EVERY COLUMN IS NOT NULL WITH A DEFAULT. A settings screen is read on member request paths
-- (the check-in gate, the workout player, the entitlement check). A nullable column would force every
-- reader to re-decide what null means, and the first reader to guess differently is a silent
-- behaviour split between two surfaces. The default IS the product behaviour before anyone saves, and
-- src/lib/coach/settings-shared.ts carries the identical set for the company that has no row yet.
--
-- Defaults are deliberately "the app as it behaves today", so applying this migration changes nothing
-- until a human moves a switch.

create table if not exists public.coach_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,

  -- ---- Chat and communication ---------------------------------------------------------------
  -- The three attachment switches describe a composer that is text-only today. They are stored so
  -- the answer exists the day attachments ship, and they are reported as not-yet-acted-on.
  is_client_audio_allowed       boolean not null default true,
  is_client_video_allowed       boolean not null default true,
  is_client_image_allowed       boolean not null default true,
  is_habit_summary_shared       boolean not null default false,
  is_upsell_shown               boolean not null default false,
  is_group_roster_shown         boolean not null default true,

  -- ---- Progress tracking ---------------------------------------------------------------------
  is_weight_shown               boolean not null default true,
  is_macros_shown               boolean not null default true,
  is_weight_shown_in_checkin    boolean not null default true,
  is_checkin_allowed            boolean not null default true,
  is_checkin_reminder_on        boolean not null default false,
  reminder_every                smallint not null default 1,
  reminder_period               text     not null default 'week',
  -- 0 = Sunday, matching JS getDay() and Postgres extract(dow), so the two never disagree.
  reminder_weekday              smallint not null default 1,
  -- Local wall-clock time, stored as HH:MM text rather than `time`, because it is applied in each
  -- client's own timezone. A `time` column invites a reader to combine it with a date and get UTC.
  reminder_time_local           text     not null default '18:00',
  is_reminder_skipped_when_done boolean  not null default true,
  reminder_skip_days            smallint not null default 7,
  is_reminder_push_on           boolean  not null default true,
  is_reminder_chat_on           boolean  not null default false,
  is_reminder_email_on          boolean  not null default false,

  -- ---- Client access -------------------------------------------------------------------------
  is_access_revoked_on_expiry   boolean not null default true,

  -- ---- Meal plan settings --------------------------------------------------------------------
  -- Empty string means "no default set": the builder then falls back to its own localized label,
  -- so an unset preference never writes an English name into a Spanish coach's plan.
  default_meal_plan_name        text not null default '',
  recipe_ingredient_display     text not null default 'grams_and_units',
  meal_plan_followup            text not null default 'none',
  meal_plan_format              text not null default 'macro',
  macro_flexibility             text not null default 'moderate',
  allergies                     text[] not null default '{}',
  dietary_preferences           text[] not null default '{}',
  avoided_ingredients           text[] not null default '{}',
  availability                  text[] not null default '{}',

  -- ---- Training plan settings ----------------------------------------------------------------
  default_training_plan_name    text not null default '',
  training_followup             text not null default 'none',
  dropset_behavior              text not null default 'separate',
  is_exercise_guide_shown       boolean not null default true,

  -- ---- Client handling and engagement --------------------------------------------------------
  measurement_unit              text not null default 'imperial',
  old_chat_days                 smallint not null default 3,
  is_birthday_reminder_on       boolean not null default false,

  -- ---- Onboarding ----------------------------------------------------------------------------
  is_onboarding_required        boolean not null default true,
  onboarding_send_when          text not null default 'after_offer',

  -- ---- Email notifications to the coach --------------------------------------------------------
  is_email_on_new_message       boolean not null default false,
  is_email_on_new_checkin       boolean not null default false,
  is_email_on_new_lead          boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,

  -- Enum-ish columns are CHECKed in the database as well as in Zod. The Zod schema guards the one
  -- route a human uses; the constraint guards every other writer, including a future backfill script.
  constraint coach_settings_reminder_every_range   check (reminder_every between 1 and 12),
  constraint coach_settings_reminder_period_valid  check (reminder_period in ('week', 'month')),
  constraint coach_settings_reminder_weekday_range check (reminder_weekday between 0 and 6),
  constraint coach_settings_reminder_time_format   check (reminder_time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  constraint coach_settings_skip_days_range        check (reminder_skip_days between 1 and 60),
  constraint coach_settings_ingredient_display_valid check (recipe_ingredient_display in ('grams_and_units', 'grams', 'units')),
  constraint coach_settings_meal_followup_valid    check (meal_plan_followup in ('none', 'three_days', 'one_week', 'two_weeks', 'one_month', 'three_months')),
  constraint coach_settings_meal_format_valid      check (meal_plan_format in ('macro', 'portion')),
  constraint coach_settings_macro_flex_valid       check (macro_flexibility in ('strict', 'moderate', 'flexible')),
  constraint coach_settings_training_followup_valid check (training_followup in ('none', 'three_days', 'one_week', 'two_weeks', 'one_month', 'three_months')),
  constraint coach_settings_dropset_valid          check (dropset_behavior in ('separate', 'combined')),
  constraint coach_settings_unit_valid             check (measurement_unit in ('imperial', 'metric')),
  constraint coach_settings_old_chat_days_range    check (old_chat_days between 1 and 60),
  constraint coach_settings_onboarding_when_valid  check (onboarding_send_when in ('after_offer', 'immediately', 'manually')),
  -- Free-text list columns are unbounded in type but not in practice. A runaway array here is read on
  -- member request paths, so cap the length rather than discover the cap during a plan generation.
  constraint coach_settings_list_sizes check (
    cardinality(allergies) <= 40
    and cardinality(dietary_preferences) <= 40
    and cardinality(avoided_ingredients) <= 200
    and cardinality(availability) <= 40
  )
);

comment on table public.coach_settings is
  'Per-company coaching preferences: what clients can do in the app, and the coach defaults for meal plans, training plans, engagement and onboarding. One row per company; company_id is the primary key. Missing row = the defaults in src/lib/coach/settings-shared.ts.';
comment on column public.coach_settings.reminder_time_local is
  'HH:MM wall clock, applied in each CLIENT''s timezone, not the coach''s. Text rather than time so no reader is tempted to combine it with a date and land on UTC.';
comment on column public.coach_settings.is_access_revoked_on_expiry is
  'When true (default) an entitlement whose expires_at has passed stops granting access. When false, a grant that is still active/trialing keeps working past its end date. Read by isEntitled().';

alter table public.coach_settings enable row level security;

-- Coach roles of the same company only. Members never read this table directly: every member-facing
-- reader goes through the service client in src/lib/coach/settings.ts, which is the same pattern the
-- rest of the coach surface uses. Leaving members out keeps her email-notification preferences and
-- her client-handling defaults off the wire for a subscriber who opens PostgREST.
drop policy if exists coach_settings_tenant on public.coach_settings;
create policy coach_settings_tenant on public.coach_settings
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- Keep updated_at honest without every writer remembering to set it.
create or replace function public.touch_coach_settings()
returns trigger language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists coach_settings_touch on public.coach_settings;
create trigger coach_settings_touch
  before update on public.coach_settings
  for each row execute function public.touch_coach_settings();

-- Give every existing company its row up front. Not seed data: it is the defaults block above, made
-- explicit, so the settings screens open on a real row and the first save is an UPDATE like every
-- one after it rather than a special first-write path.
insert into public.coach_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;
