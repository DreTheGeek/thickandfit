-- Natural keys so the Lenus sweep can be re-run without duplicating anything.
--
-- The account ends 31 August, so this import runs more than once: today for the bulk, and again
-- near the cutoff for the final days. `client_messages` already had UNIQUE (company_id,
-- external_id) and that is exactly why messages were safe to re-import; check-ins, weights and
-- measurements had nothing, so a second pass would have doubled every row.
--
-- Partial indexes scoped to source = 'lenus' / a non-null external_id, deliberately. A member can
-- legitimately weigh in twice on one day inside the app; only the MIGRATED rows carry the promise
-- of one-per-day-per-person, and constraining native rows to match would break real behaviour to
-- serve a one-off import.

alter table public.form_responses
  add column if not exists external_id text;

comment on column public.form_responses.external_id is
  'Source system id (Lenus checkInResponse.id) for migrated submissions. Null for anything filled in this app.';

create unique index if not exists form_responses_company_external_key
  on public.form_responses (company_id, external_id)
  where external_id is not null;

create unique index if not exists weight_entries_lenus_daily_key
  on public.weight_entries (company_id, profile_id, recorded_on)
  where source = 'lenus';

create unique index if not exists body_measurements_lenus_daily_key
  on public.body_measurements (company_id, profile_id, recorded_on)
  where source = 'lenus';
