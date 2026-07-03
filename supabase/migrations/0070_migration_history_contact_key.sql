-- 0070 -- Contact-keyed progress history for migration. weight_entries, body_measurements, and
-- progress_photos were profile_id NOT NULL (they assumed a signed-up subscriber). Legacy clients
-- migrated from Lenus exist as CRM contacts and have no app profile until they claim their account,
-- so their weight / measurement / photo history had nowhere to land. This adds an optional contact_id
-- to all three (mirroring food_log, which already has it) and relaxes profile_id to nullable, so the
-- imported history attaches to the contact, the coach sees it on the client detail page immediately,
-- and it transfers to the profile on claim (0042 claim flow backfills profile_id). Every row still
-- belongs to exactly one client: a row carries a profile_id OR a contact_id, never another client's.

-- ---- weight_entries -------------------------------------------------------------------------
alter table public.weight_entries add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.weight_entries alter column profile_id drop not null;
alter table public.weight_entries add constraint weight_entries_owner_ck
  check (profile_id is not null or contact_id is not null) not valid;
create index if not exists idx_weight_entries_contact on public.weight_entries (contact_id, recorded_on) where contact_id is not null;

-- ---- body_measurements ----------------------------------------------------------------------
alter table public.body_measurements add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.body_measurements alter column profile_id drop not null;
alter table public.body_measurements add constraint body_measurements_owner_ck
  check (profile_id is not null or contact_id is not null) not valid;
create index if not exists idx_body_measurements_contact on public.body_measurements (contact_id, recorded_on) where contact_id is not null;

-- ---- progress_photos ------------------------------------------------------------------------
alter table public.progress_photos add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.progress_photos alter column profile_id drop not null;
alter table public.progress_photos add column if not exists pose_source text;      -- lenus front/back/side snapshot marker
alter table public.progress_photos add constraint progress_photos_owner_ck
  check (profile_id is not null or contact_id is not null) not valid;
create index if not exists idx_progress_photos_contact on public.progress_photos (contact_id, taken_on desc) where contact_id is not null;

-- ---- coach can read contact-keyed history (client detail page, pre-claim) --------------------
-- weight_entries + body_measurements use "for all" coach policies scoped by company; a contact-keyed
-- row has company_id set, so is_coach() + company match already covers coach read. progress_photos
-- read policy is (owner OR coach) within company, likewise already covers contact rows. The added
-- coach visibility comes for free from company_id; owners still only ever see profile_id = auth.uid().

comment on column public.weight_entries.contact_id is 'Set for migrated (pre-claim) history; profile_id is null until the client claims their account, then backfilled.';
comment on column public.progress_photos.pose_source is 'Lenus snapshot pose the photo came from: front | back | side.';
