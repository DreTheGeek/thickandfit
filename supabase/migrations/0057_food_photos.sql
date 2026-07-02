-- 0057 PHASE 2 -- Food-photo check-in diary (call 2026-07-01). A client uploads meal photos so the
-- coach can keep track of what they're actually eating (Stephanie's EverFit-style ask). Photos live
-- in a PRIVATE bucket (owner writes to their own folder; reads via short-lived signed URLs). The coach
-- can read the rows (company-scoped) and signs the client's paths with the service client.

create table if not exists public.food_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  meal_slot text,
  taken_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);

create index if not exists idx_food_photos_member on public.food_photos (profile_id, taken_on desc);

alter table public.food_photos enable row level security;

drop policy if exists food_photos_owner on public.food_photos;
create policy food_photos_owner on public.food_photos for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists food_photos_coach_read on public.food_photos;
create policy food_photos_coach_read on public.food_photos for select
  using (company_id = public.current_company_id() and public.is_coach());

-- Private bucket + owner-scoped object policies (coach reads via service-client signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists food_photos_obj_insert on storage.objects;
create policy food_photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists food_photos_obj_select on storage.objects;
create policy food_photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists food_photos_obj_delete on storage.objects;
create policy food_photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
