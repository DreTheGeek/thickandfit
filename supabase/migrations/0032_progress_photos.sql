-- 0032 PHASE 2: Subscriber progress photos (PRD-24, subscriber side).
-- The client captures their own progress photos going forward (coaches already see the imported
-- Lenus photos in the client Files tab). Each row points at a PRIVATE storage object; the app reads
-- it through short-lived signed URLs (never a public URL). Owner-or-coach RLS, tenant-scoped.

-- ---------------------------------------------------------------------------------------------
-- progress_photos: one row per uploaded photo. storage_path is the object key in the
-- 'progress-photos' bucket, namespaced under the owner's profile id (profileId/uuid.jpg).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  taken_on date not null default current_date,
  pose text,
  weight_kg numeric,
  created_at timestamptz not null default now()
);

-- Gallery query: a member's photos newest-taken first.
create index if not exists idx_progress_photos_gallery
  on public.progress_photos (profile_id, taken_on desc, created_at desc);

-- One row per object key (idempotent re-inserts, and a coach can never collide a client's path).
create unique index if not exists uq_progress_photos_path
  on public.progress_photos (storage_path);

alter table public.progress_photos enable row level security;

-- Read: the owner, or a coach in the same company (client progress review).
drop policy if exists progress_photos_read on public.progress_photos;
create policy progress_photos_read on public.progress_photos for select
  using (
    company_id = public.current_company_id()
    and (profile_id = auth.uid() or public.is_coach())
  );

-- Insert: the owner adds their own photos (company must match the JWT tenant).
drop policy if exists progress_photos_insert on public.progress_photos;
create policy progress_photos_insert on public.progress_photos for insert
  with check (
    company_id = public.current_company_id()
    and profile_id = auth.uid()
  );

-- Update: the owner may edit metadata (pose / date / weight) on their own rows.
drop policy if exists progress_photos_update on public.progress_photos;
create policy progress_photos_update on public.progress_photos for update
  using (company_id = public.current_company_id() and profile_id = auth.uid())
  with check (company_id = public.current_company_id() and profile_id = auth.uid());

-- Delete: the owner may remove their own photos.
drop policy if exists progress_photos_delete on public.progress_photos;
create policy progress_photos_delete on public.progress_photos for delete
  using (company_id = public.current_company_id() and profile_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- PRIVATE storage bucket. Not public: every read goes through a signed URL minted server-side.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS: objects are namespaced by the owner's profile id as the first path segment, so
-- (storage.foldername(name))[1] is the owner. Helpers (current_company_id / is_coach) are not used
-- here because storage.objects has no company column; ownership is the profile-id folder.

-- Read: the owner of the folder, or any coach in the company (matches the row-level read).
drop policy if exists progress_photos_obj_read on storage.objects;
create policy progress_photos_obj_read on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_coach()
    )
  );

-- Insert: a member may only write into their own profile-id folder.
drop policy if exists progress_photos_obj_insert on storage.objects;
create policy progress_photos_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: owner only (e.g. overwrite / re-upload to the same key).
drop policy if exists progress_photos_obj_update on storage.objects;
create policy progress_photos_obj_update on storage.objects for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: owner only.
drop policy if exists progress_photos_obj_delete on storage.objects;
create policy progress_photos_obj_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
