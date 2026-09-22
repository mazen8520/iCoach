-- iCoach: storage buckets
-- Path convention: {bucket}/{owner_user_id}/{filename}
-- 'avatars' and 'media' (workout covers, exercise thumbnails/videos) are public-read.
-- 'progress-photos' and 'check-in-photos' are private: owner + their linked coach only.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars', 'avatars', true, 5242880),
  ('media', 'media', true, 209715200),
  ('progress-photos', 'progress-photos', false, 10485760),
  ('check-in-photos', 'check-in-photos', false, 10485760)
on conflict (id) do nothing;

-- avatars: public read, owner can manage their own folder
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_owner_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- media: public read, coach can manage their own folder (workout covers, exercise/video library)
create policy "media_public_read" on storage.objects for select
  using (bucket_id = 'media');
create policy "media_owner_write" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_owner_update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media_owner_delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- progress-photos: private, owner + their coach can read; only owner can write
create policy "progress_photos_owner_read" on storage.objects for select
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_coach_read" on storage.objects for select
  using (bucket_id = 'progress-photos' and public.is_coach_of((storage.foldername(name))[1]::uuid));
create policy "progress_photos_owner_write" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_owner_delete" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- check-in-photos: private, owner + their coach can read; only owner can write
create policy "check_in_photos_owner_read" on storage.objects for select
  using (bucket_id = 'check-in-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "check_in_photos_coach_read" on storage.objects for select
  using (bucket_id = 'check-in-photos' and public.is_coach_of((storage.foldername(name))[1]::uuid));
create policy "check_in_photos_owner_write" on storage.objects for insert
  with check (bucket_id = 'check-in-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "check_in_photos_owner_delete" on storage.objects for delete
  using (bucket_id = 'check-in-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Realtime: messages and notifications should stream live
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
