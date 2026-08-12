-- Corrects 0130, and gives check-ins the key migrated rows actually carry.
--
-- 0130 put the "one Lenus row per person per day" indexes on profile_id. Every migrated row has a
-- NULL profile_id and a real contact_id: `profile_id` is only populated once a member claims an app
-- account, and 758 of 758 Lenus weights key on contact_id. A unique index over a column that is
-- NULL for every row it targets enforces nothing, so the second sweep would have silently doubled
-- both tables. Caught before the first import, not after.
--
-- form_responses had no contact_id at all, which is the same split-brain the client page suffers
-- from: history keyed by profile_id OR contact_id, and check-ins could only ever be the former. The
-- 859 recovered submissions belong to people who have not signed into the app yet, so without this
-- column there is nowhere to put them.

drop index if exists public.weight_entries_lenus_daily_key;
drop index if exists public.body_measurements_lenus_daily_key;

create unique index if not exists weight_entries_lenus_daily_key
  on public.weight_entries (company_id, contact_id, recorded_on)
  where source = 'lenus' and contact_id is not null;

create unique index if not exists body_measurements_lenus_daily_key
  on public.body_measurements (company_id, contact_id, recorded_on)
  where source = 'lenus' and contact_id is not null;

alter table public.form_responses
  add column if not exists contact_id uuid references public.contacts (id) on delete cascade;

comment on column public.form_responses.contact_id is
  'Set for submissions migrated from Lenus, whose member has no app profile yet. Readers must accept EITHER key: profile_id for anything filled in this app, contact_id for migrated history.';

create index if not exists form_responses_contact_idx
  on public.form_responses (company_id, contact_id, submitted_at desc)
  where contact_id is not null;
