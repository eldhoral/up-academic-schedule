-- Runs as postgres after every migration. Each block raises on failure; ON_ERROR_STOP stops the run.
\set s1 '00000000-0000-0000-0000-000000000001'
\set s2 '00000000-0000-0000-0000-000000000002'
\set semua '00000000-0000-0000-0000-000000000003'
\set super '00000000-0000-0000-0000-000000000004'
\set viewer '00000000-0000-0000-0000-000000000005'

insert into auth.users (id, email) values
    (:'s1', 's1@test'), (:'s2', 's2@test'), (:'semua', 'semua@test'), (:'super', 'super@test'), (:'viewer', 'viewer@test');
update profiles set role = 'SCHEDULER', prodi_access = 's1' where id = :'s1';
update profiles set role = 'SCHEDULER', prodi_access = 's2' where id = :'s2';
update profiles set role = 'SCHEDULER', prodi_access = 'all' where id = :'semua';
update profiles set role = 'SUPERADMIN', prodi_access = 's1' where id = :'super';
update profiles set role = 'VIEWER', prodi_access = 'all' where id = :'viewer';

-- Backfill and settings split ---------------------------------------------------------------
do $$ begin
    assert (select count(*) from courses where prodi <> 's1') = 0, 'existing courses become s1';
    assert (select count(*) from schedules where prodi <> 's1') = 0, 'existing schedules become s1';
    assert (select count(*) from defenses where prodi <> 's1') = 0, 'existing defenses become s1';
    assert (select prodi from settings where key = 'bentrok_dosen') = 'all', 'clash policy is shared';
    assert not exists (select 1 from settings where key = 'bentrok_dosen' and prodi = 's2'), 'a shared key has no s2 copy';
    assert (select value from settings where key = 'nama_prodi' and prodi = 's2') = 'S2 Psikologi Profesi', 'S2 nama_prodi';
    assert (select value from settings where key = 'nama_prodi' and prodi = 's1') = 'S1 Psikologi', 'S1 nama_prodi kept';
    assert (select value from settings where key = 'sidang_header_baris' and prodi = 's2') like '%SIDANG TESIS%', 'S2 sidang header';
    assert (select value from settings where key = 'prasidang_header_baris' and prodi = 's2') like '%SEMINAR PROPOSAL TESIS%', 'S2 seminar header';
    assert (select value from settings where key = 'nama_penandatangan' and prodi = 's2') = '', 'S2 signer left for staff';
    assert (select value from settings where key = 'jam_mulai_reguler' and prodi = 's2') = '18:00', 'S2 reguler starts in the evening';
    assert (select value from settings where key = 'jam_mulai_reguler' and prodi = 's1') = '07:30', 'S1 reguler start kept';
    assert not exists (select 1 from settings where prodi = 's2' and key in ('jam_mulai_regsus', 'sesi_ujian_regsus')), 'S2 has no regsus settings';
end $$;

-- Integrity, as postgres (RLS bypassed) ------------------------------------------------------
insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S2TEST01', 'Asesmen Klinis', 3, 1, 'A', 's2');

do $$
declare ay text := (select id from academic_years order by id limit 1);
begin
    begin
        insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi)
        values (ay, 'reguler', 1, 'S2TEST01', 'A', 'SENIN', '08:00', '10:00', 's1');
        raise exception 'FAIL: an S1 schedule accepted an S2 mata kuliah';
    exception when foreign_key_violation then null;
    end;
    begin
        insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi)
        values (ay, 'reguler', 5, 'S2TEST01', 'A', 'SENIN', '08:00', '10:00', 's2');
        raise exception 'FAIL: S2 accepted semester 5';
    exception when check_violation then null;
    end;
    begin
        insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi)
        values (ay, 'regsus', 1, 'S2TEST01', 'A', 'SENIN', '08:00', '10:00', 's2');
        raise exception 'FAIL: S2 accepted regsus';
    exception when check_violation then null;
    end;
    begin
        insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S2TEST05', 'X', 2, 5, 'A', 's2');
        raise exception 'FAIL: an S2 course accepted smt 5';
    exception when check_violation then null;
    end;
    begin
        insert into exams (academic_year_id, jenis_ujian, jenis_kelas, semester_ke, kode_mk, kelas, prodi)
        values (ay, 'uts', 'reguler', 1, 'S2TEST01', 'A', 's1');
        raise exception 'FAIL: an S1 exam accepted an S2 mata kuliah';
    exception when foreign_key_violation then null;
    end;
end $$;

-- RLS: S2-only scheduler ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'s2', false);
set role authenticated;

insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi)
values ((select id from academic_years order by id limit 1), 'reguler', 1, 'S2TEST01', 'A', 'SENIN', '08:00', '10:00', 's2');
insert into schedule_lecturers (schedule_id, kode_dosen)
values ((select id from schedules where kode_mk = 'S2TEST01'), (select kode_dosen from lecturers order by kode_dosen limit 1));

do $$
declare n int; s1_schedule schedules.id%type;
begin
    begin
        insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S1TEST01', 'X', 2, 1, 'A', 's1');
        raise exception 'FAIL: S2 user inserted an S1 course';
    exception when insufficient_privilege then null;
    end;
    update courses set nama_mk = nama_mk || '' where prodi = 's1';
    get diagnostics n = row_count;
    assert n = 0, 'S2 user must not update S1 courses';
    update settings set value = value where prodi = 'all';
    get diagnostics n = row_count;
    assert n = 0, 'S2-only user must not change shared settings';
    update settings set value = value where key = 'nama_prodi' and prodi = 's2';
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change even its own prodi settings';
    select id into s1_schedule from schedules where prodi = 's1' limit 1;
    begin
        insert into schedule_lecturers (schedule_id, kode_dosen)
        values (s1_schedule, (select kode_dosen from lecturers l
                              where not exists (select 1 from schedule_lecturers sl
                                                where sl.schedule_id = s1_schedule and sl.kode_dosen = l.kode_dosen)
                              limit 1));
        raise exception 'FAIL: S2 user added a dosen to an S1 schedule';
    exception when insufficient_privilege then null;
    end;
    assert (select count(*) from schedules where prodi = 's1') > 0, 'S2 user still reads S1 schedules (clash detail needs them)';
end $$;
reset role;

-- RLS: S1-only scheduler cannot touch S2 ----------------------------------------------------
select set_config('request.jwt.claim.sub', :'s1', false);
set role authenticated;
do $$
declare n int;
begin
    delete from schedules where kode_mk = 'S2TEST01';
    get diagnostics n = row_count;
    assert n = 0, 'S1 user must not delete S2 schedules';
end $$;
reset role;

-- RLS: Semua, Super Admin (whatever its column says), Viewer --------------------------------
-- Penjadwal manages jadwal only: with access Semua it still cannot touch data master,
-- settings, the login photos or anything else Super Admin keeps.
insert into lecturers (kode_dosen, nama) values ('PJTOK', 'Penjadwal Token');
select set_config('request.jwt.claim.sub', :'semua', false);
set role authenticated;
do $$
declare n int; ay text := (select id from academic_years order by id limit 1);
begin
    insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi)
    values (ay, 'reguler', 1, 'S2TEST01', 'B', 'SELASA', '08:00', '10:00', 's2');
    update schedules set kelas = kelas where kode_mk = 'S2TEST01';
    get diagnostics n = row_count;
    assert n = 2, 'Penjadwal Semua changes schedules';

    update settings set value = value where key = 'bentrok_dosen';
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change shared settings';
    update courses set nama_mk = nama_mk;
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change courses';
    update sessions set active = active;
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change sesi';
    update lecturers set nama = nama;
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change dosen';
    update rooms set nama = nama;
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change ruangan';
    update academic_years set label = label;
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not change tahun akademik';
    delete from courses where kode_mk = 'S2TEST01';
    get diagnostics n = row_count;
    assert n = 0, 'Penjadwal must not delete courses';
    begin
        insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('PJTEST01', 'X', 2, 1, 'A', 's2');
        raise exception 'FAIL: Penjadwal inserted a course';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into students (npm, nama, prodi) values ('9990001', 'X', 's2');
        raise exception 'FAIL: Penjadwal inserted a mahasiswa';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into rooms (nama, kapasitas) values ('PJ Room', 10);
        raise exception 'FAIL: Penjadwal inserted a ruangan';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into storage.objects (bucket_id, name) values ('up_kiprat', 'login/pj.jpg');
        raise exception 'FAIL: Penjadwal uploaded a login photo';
    exception when insufficient_privilege then null;
    end;

    -- The dosen's jadwal link stays with the Penjadwal: it shares the jadwal, not the dosen record.
    assert (select set_jadwal_token('PJTOK', 'pj-token-1', false)) = 'pj-token-1', 'Penjadwal creates a jadwal link';
    assert (select set_jadwal_token('PJTOK', 'pj-token-2', false)) = 'pj-token-1', 'creating keeps an existing link';
    assert (select set_jadwal_token('PJTOK', 'pj-token-3', true)) = 'pj-token-3', 'Penjadwal resets a jadwal link';
    assert (select set_jadwal_token('NOSUCH', 'x', true)) is null, 'unknown dosen: no token';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'viewer', false);
set role authenticated;
do $$ begin
    assert (select set_jadwal_token('PJTOK', 'viewer-token', true)) is null, 'a viewer cannot reset a jadwal link';
end $$;
reset role;
do $$ begin
    assert (select jadwal_token from lecturers where kode_dosen = 'PJTOK') = 'pj-token-3', 'viewer reset changed nothing';
end $$;

select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S2TEST02', 'Super', 2, 1, 'A', 's2');
insert into storage.objects (bucket_id, name) values ('up_kiprat', 'login/super.jpg');
do $$
declare n int;
begin
    update settings set value = value where key = 'bentrok_dosen';
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin changes shared settings';
    update rooms set nama = nama;
    get diagnostics n = row_count;
    assert n > 0, 'Super Admin changes ruangan';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'viewer', false);
set role authenticated;
do $$ begin
    begin
        insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S2TEST03', 'X', 2, 1, 'A', 's2');
        raise exception 'FAIL: a viewer inserted a course';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;

-- Jadwal dosen ---------------------------------------------------------------------------------
do $$ begin
    assert exists (select 1 from information_schema.columns where table_name = 'lecturers' and column_name = 'jadwal_token'), 'lecturers.jadwal_token';
    assert exists (select 1 from information_schema.columns where table_name = 'academic_years' and column_name = 'mulai_kuliah'), 'academic_years.mulai_kuliah';
    assert has_table_privilege('service_role', 'exams', 'select'), 'service_role reads exams';
    assert has_table_privilege('service_role', 'schedule_lecturers', 'select'), 'service_role reads schedule_lecturers';
    begin
        insert into academic_years (id, label, mulai_kuliah, selesai_kuliah) values ('T9991', 'x', '2026-09-01', '2026-08-01');
        raise exception 'FAIL: selesai before mulai accepted';
    exception when check_violation then null;
    end;
end $$;

insert into lecturers (kode_dosen, nama) values ('TOKCHK', 'Token Check');
update lecturers set jadwal_token = 'secret-token-check' where kode_dosen = 'TOKCHK';
do $$ begin
    assert not exists (select 1 from audit_log where coalesce(new_data::text, '') || coalesce(old_data::text, '') like '%secret-token-check%'), 'token kept out of audit_log';
    assert exists (select 1 from audit_log where table_name = 'lecturers' and record_id = 'TOKCHK' and action = 'UPDATE'), 'the update is still logged';
end $$;

-- Beban SKS dosen ---------------------------------------------------------------------------------
do $$ begin
    assert (select value from settings where key = 'maks_sks_dosen' and prodi = 'all') = '12', 'maks_sks_dosen shared, 12 by default';
    assert (select value from settings where key = 'bentrok_beban' and prodi = 'all') = 'peringatan', 'bentrok_beban shared, peringatan by default';
    assert not exists (select 1 from settings where key in ('maks_sks_dosen', 'bentrok_beban') and prodi <> 'all'), 'a dosen''s load spans both prodi: one shared row each';
end $$;

-- Reset jadwal: Super Admin only, one academic year, only the ticked jadwal × prodi ---------------
insert into academic_years (id, label) values ('R0001', 'Reset A'), ('R0002', 'Reset B');
insert into courses (kode_mk, nama_mk, sks, smt, jenis_mk, prodi) values ('S1RST01', 'Reset S1', 2, 1, 'A', 's1');
insert into schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, prodi) values
    ('R0001', 'reguler', 1, 'S1RST01', 'A', 'SENIN', '08:00', '10:00', 's1'),
    ('R0001', 'reguler', 1, 'S2TEST01', 'A', 'SENIN', '08:00', '10:00', 's2'),
    ('R0002', 'reguler', 1, 'S1RST01', 'A', 'SENIN', '08:00', '10:00', 's1');
insert into schedule_lecturers (schedule_id, kode_dosen)
    select id, 'TOKCHK' from schedules where academic_year_id = 'R0001' and prodi = 's1';
insert into exams (academic_year_id, jenis_ujian, jenis_kelas, semester_ke, kode_mk, kelas, prodi) values
    ('R0001', 'uts', 'reguler', 1, 'S1RST01', 'A', 's1'),
    ('R0001', 'uas', 'reguler', 1, 'S2TEST01', 'A', 's2');
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, prodi) values
    ('R0001', 'prasidang', '2026-11-02', '08:00', '09:00', 1, '1001', 'Satu', 's1'),
    ('R0001', 'prasidang', '2026-11-02', '08:00', '09:00', 1, '2001', 'Dua', 's2');

select set_config('request.jwt.claim.sub', :'semua', false);
set role authenticated;
do $$ begin
    begin
        perform reset_jadwal('R0001', array['s1', 's2'], array['s1', 's2'], array['s1', 's2']);
        raise exception 'FAIL: a Penjadwal reset jadwal';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;
do $$ begin
    assert (select count(*) from schedules where academic_year_id = 'R0001') = 2, 'Penjadwal reset deleted nothing';
end $$;

select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
do $$
declare r jsonb;
begin
    -- Kuliah S1 and both prodi's sidang; UTS/UAS and kuliah S2 kept.
    r := reset_jadwal('R0001', array['s1'], array[]::text[], array['s1', 's2']);
    assert r = '{"kuliah": 1, "ujian": 0, "sidang": 2}'::jsonb, 'reset returns what it deleted: ' || r::text;
end $$;
reset role;
do $$ begin
    assert (select count(*) from schedules where academic_year_id = 'R0001' and prodi = 's1') = 0, 'kuliah S1 reset';
    assert (select count(*) from schedules where academic_year_id = 'R0001' and prodi = 's2') = 1, 'kuliah S2 kept';
    assert (select count(*) from schedules where academic_year_id = 'R0002') = 1, 'another year kept';
    assert not exists (select 1 from schedule_lecturers sl where not exists (select 1 from schedules s where s.id = sl.schedule_id)), 'dosen rows go with their jadwal';
    assert (select count(*) from exams where academic_year_id = 'R0001') = 2, 'UTS/UAS kept';
    assert (select count(*) from defenses where academic_year_id = 'R0001') = 0, 'sidang and seminar reset';
    assert exists (select 1 from audit_log where table_name = 'schedules' and action = 'DELETE'), 'reset is in the audit log';
end $$;

-- Penguji I from the dosen master: a sidang only, never a dosen already on that sidang.
do $$
declare d text := (select kode_dosen from lecturers order by kode_dosen limit 1);
declare d2 text := (select kode_dosen from lecturers order by kode_dosen offset 1 limit 1);
begin
    insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, npm, nama_mahasiswa, pembimbing_kode, penguji_eksternal_kode)
    values ('R0002', 'sidang', '2026-11-09', '08:00', '10:00', '99001', 'P1', d2, d);
    begin
        insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, penguji_eksternal_kode)
        values ('R0002', 'prasidang', '2026-11-09', '08:00', '10:00', 1, '99002', 'P2', d);
        raise exception 'FAIL: a prasidang took a Penguji I';
    exception when check_violation then null;
    end;
    begin
        insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, npm, nama_mahasiswa, pembimbing_kode, penguji_eksternal_kode)
        values ('R0002', 'sidang', '2026-11-09', '08:00', '10:00', '99003', 'P3', d, d);
        raise exception 'FAIL: one dosen as Penguji I and II';
    exception when check_violation then null;
    end;
    begin
        insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, npm, nama_mahasiswa, penguji_eksternal, penguji_eksternal_kode)
        values ('R0002', 'sidang', '2026-11-09', '08:00', '10:00', '99004', 'P4', 'Prof. X', d);
        raise exception 'FAIL: Penguji I both typed and picked';
    exception when check_violation then null;
    end;
end $$;
