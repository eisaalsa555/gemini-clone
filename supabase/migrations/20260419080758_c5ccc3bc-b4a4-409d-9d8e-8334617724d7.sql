drop policy if exists "Anyone can view chat uploads" on storage.objects;
create policy "Users view own chat uploads" on storage.objects for select
  using (bucket_id = 'chat-uploads' and auth.uid()::text = (storage.foldername(name))[1]);