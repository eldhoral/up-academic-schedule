-- Storage bucket for the login page photo carousel, managed from Pengaturan.
-- Public so the (unauthenticated) login page can display the photos; only
-- authenticated users may upload/replace/remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('up_kiprat', 'up_kiprat', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read access to up_kiprat" on storage.objects;
create policy "Public read access to up_kiprat"
    on storage.objects for select
    to public
    using (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can upload to up_kiprat" on storage.objects;
create policy "Authenticated users can upload to up_kiprat"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can update up_kiprat" on storage.objects;
create policy "Authenticated users can update up_kiprat"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'up_kiprat')
    with check (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can delete from up_kiprat" on storage.objects;
create policy "Authenticated users can delete from up_kiprat"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'up_kiprat');
