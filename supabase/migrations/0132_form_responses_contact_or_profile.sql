-- A check-in can belong to a contact instead of a profile.
--
-- form_responses.profile_id is NOT NULL, which encodes an assumption that only signed-in app
-- members ever submit a form. Her 859 migrated Lenus check-ins break it: those members have not
-- claimed an app account, so they exist as contacts and nothing else. This is the same
-- either-key shape client_workout_history, weight_entries and body_measurements already use.
--
-- The CHECK replaces the NOT NULL rather than removing the guarantee. Dropping NOT NULL on its own
-- would allow a row keyed to nobody, which is worse than the constraint it replaces: an orphan
-- response is invisible on every page and impossible to attribute later.

alter table public.form_responses
  alter column profile_id drop not null;

alter table public.form_responses
  drop constraint if exists form_responses_has_owner;

alter table public.form_responses
  add constraint form_responses_has_owner
  check (profile_id is not null or contact_id is not null);

comment on constraint form_responses_has_owner on public.form_responses is
  'Every response belongs to someone: profile_id for an app member, contact_id for migrated Lenus history. Readers must handle both.';
