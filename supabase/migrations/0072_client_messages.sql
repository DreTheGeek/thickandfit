-- 0072 -- Migrated conversation archive. Every coach<->client message from Lenus (Coach Steph /
-- Daniella / Nathalia and the client), so the full relationship history moves over and Stephanie
-- never loses context. Kept in a DEDICATED table (not public.messages, which is live in-app coach
-- messaging keyed to two profiles): a legacy client is a CRM contact with no profile yet, so the
-- archive is contact-keyed, and profile_id is backfilled on account claim (like the progress tables).
-- Each row belongs to exactly one client's contact; unique external_id makes the import idempotent.

create table if not exists public.client_messages (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete set null,
  external_id     text,                       -- Lenus message id (idempotency key)
  is_from_coach   boolean not null,
  sender_name     text,                       -- 'Coach Steph' / 'Coach Daniella' / null for the client
  body            text,
  msg_type        text,                       -- custom | broadcast | measurementReminder | tinyHabit | lessonLink | newOffer
  sent_at         timestamptz not null,
  read_at         timestamptz,
  has_attachments boolean not null default false,
  attachments     jsonb,                      -- [{ name, mimeType, kind, storage_path }] after media download
  source          text not null default 'lenus',
  created_at      timestamptz not null default now(),
  unique (company_id, external_id)
);

create index if not exists idx_client_messages_contact on public.client_messages (contact_id, sent_at);
create index if not exists idx_client_messages_profile on public.client_messages (profile_id, sent_at) where profile_id is not null;

alter table public.client_messages enable row level security;

-- Coaches / assistant coaches / operators read + write the archive.
drop policy if exists client_messages_coach_rw on public.client_messages;
create policy client_messages_coach_rw on public.client_messages for all
  using (company_id = public.current_company_id() and public.is_coach())
  with check (company_id = public.current_company_id() and public.is_coach());

-- The owner (once claimed) reads their own conversation history.
drop policy if exists client_messages_owner_read on public.client_messages;
create policy client_messages_owner_read on public.client_messages for select
  using (company_id = public.current_company_id() and profile_id = auth.uid());

comment on table public.client_messages is
  'Migrated coach<->client conversation history from Lenus, contact-keyed (profile_id backfilled on '
  'account claim). Distinct from public.messages (live in-app messaging).';

-- ---- private storage bucket for chat image/file attachments -----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 26214400,  -- 25 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf', 'video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Objects are namespaced by the owner contact id as the first path segment. Coach reads any object in
-- the tenant; the owner reads their own folder once claimed. The importer writes via the service role.
drop policy if exists chat_attachments_obj_read on storage.objects;
create policy chat_attachments_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and public.is_coach());

-- ---- claim flow: also transfer the conversation archive onto the new profile ------------------
create or replace function public.claim_legacy_contact()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid := public.current_company_id();
  v_email text;
  v_contact public.contacts;
begin
  if v_uid is null or v_company is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_session');
  end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_email');
  end if;
  select * into v_contact
  from public.contacts
  where company_id = v_company and type = 'client' and is_legacy = true and profile_id is null and lower(email) = v_email
  limit 1;
  if v_contact.id is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_match');
  end if;

  update public.contacts set profile_id = v_uid, updated_at = now() where id = v_contact.id and profile_id is null;
  update public.profiles set is_legacy_client = true, legacy_source = 'lenus', lenus_profile_id = v_contact.lenus_id where id = v_uid;

  update public.weight_entries    set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.body_measurements set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.progress_photos   set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.food_log          set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_intake     set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;
  update public.client_messages   set profile_id = v_uid where contact_id = v_contact.id and profile_id is null;

  return jsonb_build_object('claimed', true, 'contact_id', v_contact.id, 'lenus_id', v_contact.lenus_id);
end;
$$;
revoke all on function public.claim_legacy_contact() from public;
grant execute on function public.claim_legacy_contact() to authenticated;
