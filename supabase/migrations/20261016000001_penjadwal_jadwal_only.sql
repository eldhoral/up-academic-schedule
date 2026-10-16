-- Penjadwal (SCHEDULER) manages jadwal only: schedules, schedule_lecturers, exams and
-- defenses keep can_write_prodi(). Data master, settings and the login photos become
-- Super Admin only. The dosen's jadwal link stays with the Penjadwal through
-- set_jadwal_token(), since lecturers itself is now Super Admin only.

-- Same shape as is_scheduler_or_above(): security definer, fixed search_path.
create or replace function is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'SUPERADMIN')
$$;

do $$
declare t text;
begin
    foreach t in array array['academic_years', 'lecturers', 'rooms', 'courses', 'students', 'sessions', 'settings']
    loop
        execute format('drop policy if exists %I on %I', t || '_insert', t);
        execute format('create policy %I on %I for insert to authenticated with check (is_superadmin())', t || '_insert', t);
        execute format('drop policy if exists %I on %I', t || '_update', t);
        execute format('create policy %I on %I for update to authenticated using (is_superadmin()) with check (is_superadmin())', t || '_update', t);
        execute format('drop policy if exists %I on %I', t || '_delete', t);
        execute format('create policy %I on %I for delete to authenticated using (is_superadmin())', t || '_delete', t);
    end loop;
end $$;

drop policy if exists "Authenticated users can upload to up_kiprat" on storage.objects;
create policy "Authenticated users can upload to up_kiprat"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'up_kiprat' and is_superadmin());

drop policy if exists "Authenticated users can update up_kiprat" on storage.objects;
create policy "Authenticated users can update up_kiprat"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'up_kiprat' and is_superadmin())
    with check (bucket_id = 'up_kiprat' and is_superadmin());

drop policy if exists "Authenticated users can delete from up_kiprat" on storage.objects;
create policy "Authenticated users can delete from up_kiprat"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'up_kiprat' and is_superadmin());

-- Sets a dosen's jadwal link token and returns the token now stored. Without p_reset an
-- existing token is kept (and returned); null means not allowed or no such dosen.
create or replace function set_jadwal_token(p_kode_dosen text, p_token text, p_reset boolean)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare t text;
begin
    if not is_scheduler_or_above() then
        return null;
    end if;
    update lecturers set jadwal_token = p_token
    where kode_dosen = p_kode_dosen and (p_reset or jadwal_token is null)
    returning jadwal_token into t;
    if t is null then
        select jadwal_token into t from lecturers where kode_dosen = p_kode_dosen;
    end if;
    return t;
end
$$;

revoke execute on function set_jadwal_token(text, text, boolean) from public;
grant execute on function set_jadwal_token(text, text, boolean) to authenticated;
