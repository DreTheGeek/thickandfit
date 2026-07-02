-- 0055 PHASE 2 -- Public bucket for community post images. A member attaches a photo to a post; the
-- feed renders it by public URL. Uploads are scoped so a member can only write into their own folder
-- (path prefixed by their profile id). Public read (the feed <img> uses the public URL).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media', 'community-media', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

drop policy if exists community_media_insert on storage.objects;
create policy community_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists community_media_delete on storage.objects;
create policy community_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
