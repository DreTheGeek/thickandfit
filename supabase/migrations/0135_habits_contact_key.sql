-- Let a migrated client hold a habit, and give her cycle facts somewhere to live.
--
-- WHAT BLOCKED THIS: habits.profile_id is NOT NULL and there is no contact_id, so the 126 tiny
-- habits recovered from Lenus could not be inserted at all. Not one of those 126 belongs to someone
-- who has claimed an app account. Same defect that hid 851 check-ins and 2,286 progress photos
-- earlier this month; same fix, following 0132_form_responses_contact_or_profile.sql.
--
-- HER HABITS ARE NOT OUR HABITS. public.habits models a daily checkbox: title, cadence,
-- target_count, and a habit_logs row per completed day. Lenus models a "tiny habit" as an
-- if-then: behaviour ("I drink a large glass of water") paired with a trigger ("when I crave
-- unhealthy foods"), in a category. The behaviour maps onto title; the trigger has nowhere to go
-- and is the half that makes the habit work, so it gets a column.
--
-- NO COMPLETION HISTORY EXISTS. Lenus returns the habit definition and nothing about whether it was
-- done on any given day, so habit_logs stays empty for imported rows. habit_logs gets the same
-- contact key anyway: the column is cheap now and a schema change under a member's live data later
-- is not, and the calendar must be able to say "no history" rather than "never did it".
--
-- CYCLE GOES ON client_intake, NOT cycle_profiles. cycle_profiles is keyed profile_id PRIMARY KEY
-- and the coach reads it through coach_cycle_window, which joins cycle_day_logs and cycle_logs.
-- What the sweep recovered for 18 women is a SUMMARY (type, typical length) with no day logs and no
-- period logs behind it, so importing it there would mean restructuring a primary key the live
-- member-facing cycle feature depends on, to populate a card that would still render empty.
-- client_intake is already contact-keyed, already unique per contact, and already renders on the
-- Health tab beside her injuries and conditions, which is where "her cycle is regular, 28 days"
-- actually belongs.

alter table public.habits
  add column if not exists contact_id uuid references public.contacts (id) on delete cascade,
  add column if not exists trigger_text text,
  add column if not exists category text,
  add column if not exists source text not null default 'app',
  add column if not exists lenus_id text;

alter table public.habits alter column profile_id drop not null;

alter table public.habits drop constraint if exists habits_has_owner;
alter table public.habits
  add constraint habits_has_owner check (profile_id is not null or contact_id is not null);

create index if not exists idx_habits_contact on public.habits (company_id, contact_id) where contact_id is not null;
create unique index if not exists idx_habits_lenus_id
  on public.habits (company_id, lenus_id) where lenus_id is not null;

comment on column public.habits.trigger_text is
  'The "when" half of an if-then habit, e.g. "when I crave unhealthy foods". Her Lenus habits are all shaped this way and the trigger is the half that makes one stick.';
comment on column public.habits.contact_id is
  'Set for habits migrated from Lenus, whose owner has no app profile yet. Readers must accept EITHER key.';
comment on constraint habits_has_owner on public.habits is
  'Every habit belongs to someone: profile_id for an app member, contact_id for migrated history.';

alter table public.habit_logs
  add column if not exists contact_id uuid references public.contacts (id) on delete cascade;

alter table public.habit_logs alter column profile_id drop not null;

alter table public.habit_logs drop constraint if exists habit_logs_has_owner;
alter table public.habit_logs
  add constraint habit_logs_has_owner check (profile_id is not null or contact_id is not null);

comment on table public.habit_logs is
  'One row per habit per completed day. EMPTY for habits migrated from Lenus: it returns the habit definition and no completion history, so a missing row there means "not known", not "not done".';

-- ---------------------------------------------------------------------------------------------
-- Her cycle summary, and the good-habits half of her intake.
-- ---------------------------------------------------------------------------------------------
alter table public.client_intake
  add column if not exists good_habits text,
  add column if not exists cycle_type text,
  add column if not exists cycle_length_days smallint;

alter table public.client_intake drop constraint if exists client_intake_cycle_type_valid;
alter table public.client_intake
  add constraint client_intake_cycle_type_valid
  check (cycle_type is null or cycle_type in ('regular', 'irregular', 'unsure'));

alter table public.client_intake drop constraint if exists client_intake_cycle_length_range;
alter table public.client_intake
  add constraint client_intake_cycle_length_range
  check (cycle_length_days is null or cycle_length_days between 15 and 90);

comment on column public.client_intake.good_habits is
  'Her own words on what is already working, the counterpart to bad_habits. Both come from the Lenus intake and neither was captured before.';
comment on column public.client_intake.cycle_type is
  'Recovered from Lenus for the 18 clients who tracked. A SUMMARY only: no day logs or period logs came with it, so nothing here feeds the cycle phase maths.';
