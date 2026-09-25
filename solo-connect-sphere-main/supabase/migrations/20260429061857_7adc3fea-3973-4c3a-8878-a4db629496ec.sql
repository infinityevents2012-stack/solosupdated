
-- Restrict storage listing: only allow SELECT to authenticated participants via direct path access
drop policy if exists "dm_images_public_read" on storage.objects;
create policy "dm_images_auth_read" on storage.objects for select
  using (bucket_id = 'dm-images' and auth.role() = 'authenticated');

-- Revoke EXECUTE on internal helper from anon/authenticated; only definer-owner & policies use it
revoke execute on function public.is_conversation_participant(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
