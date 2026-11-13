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

-- Keterangan ujian starts empty; the old values still pass, nothing else does.
do $$
begin
    assert (select column_default from information_schema.columns where table_name = 'exams' and column_name = 'keterangan_ujian') = '''''::character varying', 'keterangan_ujian defaults to empty';
    assert (select count(*) from pg_constraint where conrelid = 'exams'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%keterangan_ujian%') = 1, 'one keterangan check, the old one dropped';
    begin
        update exams set keterangan_ujian = 'luring' where id = (select id from exams limit 1);
        raise exception 'FAIL: an unknown keterangan saved';
    exception when check_violation then null;
    end;
end $$;

-- DOSEN: one lecturer, its own profile row only; every staff table reads empty -----------------
\set dosen '00000000-0000-0000-0000-000000000006'
\set dosen2 '00000000-0000-0000-0000-000000000007'
insert into lecturers (kode_dosen, nama) values ('DSN01', 'Dosen Satu');
insert into holidays (tanggal, label) values ('2026-12-25', 'Natal');
insert into sessions (hari, sesi_ke, jam_mulai, jam_selesai, sks) values ('SENIN', 1, '07:30', '09:10', 2);
insert into auth.users (id, email) values (:'dosen', 'dosen@test');
update profiles set role = 'DOSEN', kode_dosen = 'DSN01' where id = :'dosen';

-- The tables a DOSEN must not see; each holds rows, so "reads 0" proves the policy.
create temp table dosen_hidden (t text);
insert into dosen_hidden values ('academic_years'), ('courses'), ('lecturers'), ('rooms'), ('sessions'), ('schedules'),
    ('schedule_lecturers'), ('settings'), ('holidays'), ('students'), ('exams'), ('defenses'), ('audit_log');
grant select on dosen_hidden to authenticated;
do $$
declare t text; n int;
begin
    for t in select * from dosen_hidden loop
        execute format('select count(*) from %I', t) into n;
        assert n > 0, t || ' has rows to hide';
    end loop;
end $$;

select set_config('request.jwt.claim.sub', :'dosen', false);
set role authenticated;
do $$
declare t text; n int;
begin
    for t in select * from dosen_hidden loop
        execute format('select count(*) from %I', t) into n;
        assert n = 0, 'DOSEN reads ' || t || ': ' || n;
    end loop;
    assert (select count(*) from profiles) = 1, 'DOSEN reads only its own profile';
    assert my_kode_dosen() = 'DSN01', 'my_kode_dosen() is the DOSEN''s lecturer';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'viewer', false);
set role authenticated;
do $$ begin
    assert (select count(*) from lecturers) > 0, 'the viewer still reads lecturers';
    assert (select count(*) from profiles) > 1, 'the viewer still reads the roster';
    assert my_kode_dosen() is null, 'staff have no my_kode_dosen()';
end $$;
reset role;

do $$ begin
    begin
        update profiles set kode_dosen = null where id = '00000000-0000-0000-0000-000000000006';
        raise exception 'FAIL: a DOSEN without kode_dosen';
    exception when check_violation then null;
    end;
    begin
        update profiles set kode_dosen = 'DSN01' where id = '00000000-0000-0000-0000-000000000005';
        raise exception 'FAIL: a staff account with kode_dosen';
    exception when check_violation then null;
    end;
    begin
        delete from lecturers where kode_dosen = 'DSN01';
        raise exception 'FAIL: deleted a lecturer that has a DOSEN account';
    exception when foreign_key_violation then null;
    end;
end $$;

insert into auth.users (id, email) values (:'dosen2', 'dosen2@test');
do $$ begin
    begin
        update profiles set role = 'DOSEN', kode_dosen = 'DSN01' where id = '00000000-0000-0000-0000-000000000007';
        raise exception 'FAIL: two DOSEN accounts for DSN01';
    exception when unique_violation then null;
    end;
end $$;

-- Nilai Bimbingan: master fields, rules, grades, dosen lock -------------------------------------
-- "Today" is the Jakarta date (R1): pras1 yesterday, pras2 the day after tomorrow, pras0 old.
insert into lecturers (kode_dosen, nama) values ('DSN02', 'Dosen Dua'), ('DSN03', 'Dosen Tiga');
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, pembimbing_kode, penguji_kode, prodi)
select 'R0002', 'prasidang', (now() at time zone 'Asia/Jakarta')::date + d, '08:00', '09:00', 1, npm, npm, 'DSN01', 'DSN02', 's1'
from (values ('88000', -5), ('88001', -1), ('88002', 2)) v(npm, d);
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, npm, nama_mahasiswa, pembimbing_kode, prodi)
values ('R0002', 'sidang', (now() at time zone 'Asia/Jakarta')::date - 1, '08:00', '10:00', '88003', 'Sidang', 'DSN01', 's1');
-- A DOSEN cannot read defenses; the test reads the ids from here.
create temp table nb_def as
    select case npm when '88000' then 'pras0' when '88001' then 'pras1' when '88002' then 'pras2' else 'sidang' end as k, id
    from defenses where npm in ('88000', '88001', '88002', '88003');
grant select on nb_def to authenticated;

do $$ begin
    assert (select count(*) from aturan_penilaian where prodi = 's1') = 7, 'seven s1 rules seeded';
    assert (select sum((a ->> 'bobot')::int) from aturan_penilaian, jsonb_array_elements(nilai) a
            where prodi = 's1' and kunci = 'aspek_bimbingan') = 100, 'aspek bobot sums to 100';
    assert (select jsonb_array_length(nilai) from aturan_penilaian where prodi = 's1' and kunci = 'tabel_nilai') = 9, 'nine Nilai rows';
    assert (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'sks_skripsi') = '6'::jsonb, 'sks skripsi 6';
    assert (select nilai #>> '{}' from aturan_penilaian where prodi = 's1' and kunci = 'tanggal_mulai_penilaian')
           = to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD'), 'start date is the migration day';
end $$;

-- Super Admin moves the start date ahead so pras0 counts as old.
select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
do $$
declare n int;
begin
    update aturan_penilaian set nilai = to_jsonb(to_char((now() at time zone 'Asia/Jakarta')::date + 10, 'YYYY-MM-DD'))
    where prodi = 's1' and kunci = 'tanggal_mulai_penilaian';
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin edits the rules';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'dosen', false);
set role authenticated;
do $$
declare n int; a jsonb := '[{"label": "A", "bobot": 100, "skor": 80}]';
begin
    insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
    values ((select id from nb_def where k = 'pras1'), 'DSN01', 'pembimbing_1', a, 80, auth.uid());
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from nb_def where k = 'pras1'), 'DSN01', 'pembimbing_1', a, 80, auth.uid());
        raise exception 'FAIL: a dosen graded twice';
    exception when unique_violation then null;
    end;
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from nb_def where k = 'pras1'), 'DSN01', 'pembimbing_2', a, 80, auth.uid());
        raise exception 'FAIL: a dosen graded as the other pembimbing';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from nb_def where k = 'pras2'), 'DSN01', 'pembimbing_1', a, 80, auth.uid());
        raise exception 'FAIL: a dosen graded before the prasidang date';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from nb_def where k = 'sidang'), 'DSN01', 'pembimbing_1', a, 80, auth.uid());
        raise exception 'FAIL: a dosen graded a sidang as bimbingan';
    exception when insufficient_privilege then null;
    end;
    update nilai_bimbingan set nilai = 90;
    get diagnostics n = row_count;
    assert n = 0, 'a dosen never edits a grade';
    delete from nilai_bimbingan;
    get diagnostics n = row_count;
    assert n = 0, 'a dosen never deletes a grade';
    update aturan_penilaian set nilai = nilai;
    get diagnostics n = row_count;
    assert n = 0, 'a dosen never edits the rules';
    assert (select count(*) from nilai_bimbingan) = 1, 'a dosen reads its own grade';
    assert (select count(*) from audit_log) = 0, 'a dosen reads no audit log';
    assert (select count(*) from aturan_penilaian) = 7, 'a dosen reads the rules';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
do $$
declare n int; a jsonb := '[{"label": "A", "bobot": 100, "skor": 70}]';
begin
    update nilai_bimbingan set nilai = 70, aspek = a where defense_id = (select id from nb_def where k = 'pras1');
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin edits a submitted grade';
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from nb_def where k = 'pras1'), 'DSN02', 'pembimbing_2', a, 70, auth.uid());
        raise exception 'FAIL: Super Admin graded for a dosen';
    exception when insufficient_privilege then null;
    end;
    insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, sumber, submitted_by)
    values ((select id from nb_def where k = 'pras0'), 'DSN01', 'pembimbing_1', a, 70, 'manual', auth.uid());
    update aturan_penilaian set nilai = to_jsonb(to_char((now() at time zone 'Asia/Jakarta')::date - 30, 'YYYY-MM-DD'))
    where prodi = 's1' and kunci = 'tanggal_mulai_penilaian';
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, sumber, submitted_by)
        values ((select id from nb_def where k = 'pras1'), 'DSN02', 'pembimbing_2', a, 70, 'manual', auth.uid());
        raise exception 'FAIL: Super Admin entered a manual grade after the start date';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;

do $$
declare pras1 uuid := (select id from nb_def where k = 'pras1');
begin
    assert exists (select 1 from audit_log where table_name = 'aturan_penilaian' and record_id = 'tanggal_mulai_penilaian'), 'rule edits are audited';
    assert (select count(*) from audit_log where table_name = 'nilai_bimbingan' and actor_id = '00000000-0000-0000-0000-000000000006') = 1, 'the dosen is the audited actor';
    begin
        update defenses set pembimbing_kode = 'DSN03' where id = pras1;
        raise exception 'FAIL: changed a graded pembimbing';
    exception when raise_exception then
        assert sqlerrm = 'Dosen pembimbing tidak dapat diubah: prasidang ini sudah dinilai.', sqlerrm;
    end;
    update defenses set penguji_kode = 'DSN03' where id = pras1;
    -- Renaming a lecturer's kode is not a reassignment: the grade follows it.
    update lecturers set kode_dosen = 'DSN01X' where kode_dosen = 'DSN01';
    assert (select kode_dosen from nilai_bimbingan where defense_id = pras1) = 'DSN01X', 'grade follows the renamed kode';
    update lecturers set kode_dosen = 'DSN01' where kode_dosen = 'DSN01X';
    begin
        delete from defenses where id = pras1;
        raise exception 'FAIL: deleted a graded prasidang';
    exception when foreign_key_violation then null;
    end;
    begin
        update students set sks_sebelum = 140, bobot_sebelum = 600 where id = (select id from students limit 1);
        raise exception 'FAIL: bobot above 4 x sks';
    exception when check_violation then null;
    end;
    update students set sks_sebelum = 140, bobot_sebelum = 404.57, tepat_waktu = true, email = 'a@b.id' where id = (select id from students limit 1);
    begin
        update students set email = 'x' where id = (select id from students limit 1);
        raise exception 'FAIL: a bad student email';
    exception when check_violation then null;
    end;
    begin
        update lecturers set email = 'x' where kode_dosen = 'DSN02';
        raise exception 'FAIL: a bad lecturer email';
    exception when check_violation then null;
    end;
    update lecturers set email = 'dsn02@up.ac.id', eksternal = true where kode_dosen = 'DSN02';
end $$;

-- Nilai Bimbingan hardening ---------------------------------------------------------------------
-- The admin client (loadPenilaian, Penilaian Saya) reads these as service_role.
do $$ begin
    assert has_table_privilege('service_role', 'students', 'select'), 'service_role reads students';
    assert has_table_privilege('service_role', 'nilai_bimbingan', 'select'), 'service_role reads nilai_bimbingan';
    assert has_table_privilege('service_role', 'aturan_penilaian', 'select'), 'service_role reads aturan_penilaian';
    -- The nightly cron job runs as postgres, the owner; nobody signed in may purge the log.
    assert not has_function_privilege('authenticated', 'purge_old_audit_log()', 'execute'), 'authenticated cannot purge audit_log';
    assert not has_function_privilege('anon', 'purge_old_audit_log()', 'execute'), 'anon cannot purge audit_log';
    assert has_function_privilege('postgres', 'purge_old_audit_log()', 'execute'), 'the cron owner still purges';
end $$;

-- A grade of DSN02's (seeded as postgres) and a fresh prasidang DSN01 grades from yesterday.
select set_config('request.jwt.claim.sub', '', false);
insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, sumber)
values ((select id from nb_def where k = 'pras0'), 'DSN02', 'pembimbing_2', '[{"label": "A", "bobot": 100, "skor": 60}]', 60, 'manual');
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, pembimbing_kode, penguji_kode, prodi)
values ('R0002', 'prasidang', (now() at time zone 'Asia/Jakarta')::date - 1, '08:00', '09:00', 1, '88004', '88004', 'DSN01', 'DSN02', 's1');
insert into nb_def select 'pras4', id from defenses where npm = '88004';
select set_config('nb.total', (select count(*)::text from nilai_bimbingan), false);

select set_config('request.jwt.claim.sub', :'dosen', false);
set role authenticated;
do $$
declare
    pras4 uuid := (select id from nb_def where k = 'pras4');
    bad jsonb;
    r record;
begin
    assert not exists (select 1 from nilai_bimbingan where kode_dosen = 'DSN02'), 'DSN01 cannot read DSN02''s grade';
    -- nilai is tied to aspek: a shape the form never sends is refused.
    foreach bad in array array[
        '[{"label": "x", "bobot": 1, "skor": 0}]',
        '[]',
        '{"label": "A", "bobot": 100, "skor": 80}',
        '[{"label": "A", "bobot": 100, "skor": 101}]',
        '[{"label": "A", "bobot": 100, "skor": -1}]',
        '[{"label": " ", "bobot": 100, "skor": 80}]',
        '[{"label": "A", "bobot": 0, "skor": 80}, {"label": "B", "bobot": 100, "skor": 80}]',
        '[{"label": "A", "bobot": "100", "skor": 80}]',
        '[{"label": "A", "bobot": 100}]'
    ]::jsonb[]
    loop
        begin
            insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_at, submitted_by)
            values (pras4, 'DSN01', 'pembimbing_1', bad, 100, '2020-01-01', auth.uid());
            raise exception 'FAIL: a bad aspek was accepted: %', bad;
        exception when check_violation then null;
        end;
    end loop;
    -- The DB computes nilai and the timestamps: the client's values are ignored.
    insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_at, created_at, submitted_by)
    values (pras4, 'DSN01', 'pembimbing_1',
            '[{"label": "A", "bobot": 33.33, "skor": 80.25}, {"label": "B", "bobot": 66.67, "skor": 71}]',
            12, '2020-01-01', '2020-01-01', auth.uid());
    select nilai, submitted_at, created_at into r from nilai_bimbingan where defense_id = pras4;
    assert r.nilai = 74.08, 'nilai recomputed from aspek: ' || r.nilai;
    assert r.submitted_at > now() - interval '1 minute', 'submitted_at is the insert time';
    assert r.created_at > now() - interval '1 minute', 'created_at is the insert time';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'s1', false);
set role authenticated;
do $$ begin
    assert (select count(*) from nilai_bimbingan) = current_setting('nb.total')::int + 1, 'a Penjadwal reads every grade';
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'viewer', false);
set role authenticated;
do $$ begin
    assert (select count(*) from nilai_bimbingan) = current_setting('nb.total')::int + 1, 'a viewer reads every grade';
end $$;
reset role;

-- Super Admin edits aspek only; the grade's owner, peran and history stay. Rules are never deleted.
select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
do $$
declare
    pras4 uuid := (select id from nb_def where k = 'pras4');
    c text;
    n int;
begin
    foreach c in array array['peran', 'kode_dosen', 'sumber', 'defense_id', 'submitted_at', 'submitted_by', 'created_at'] loop
        begin
            execute format('update nilai_bimbingan set %I = %I where defense_id = $1', c, c) using pras4;
            raise exception 'FAIL: Super Admin updated nilai_bimbingan.%', c;
        exception when insufficient_privilege then null;
        end;
    end loop;
    update nilai_bimbingan set aspek = '[{"label": "A", "bobot": 100, "skor": 65.5}]', nilai = 1 where defense_id = pras4;
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin edits aspek';
    assert (select nilai from nilai_bimbingan where defense_id = pras4) = 65.5, 'an edit recomputes nilai';
    delete from aturan_penilaian where prodi = 's1' and kunci = 'tanggal_mulai_penilaian';
    get diagnostics n = row_count;
    assert n = 0, 'Super Admin never deletes a rule';
end $$;
reset role;

-- A graded prasidang keeps its student: npm, jenis and prodi are locked; other edits still save.
do $$
declare
    pras1 uuid := (select id from nb_def where k = 'pras1');
    pras2 uuid := (select id from nb_def where k = 'pras2');
    c text;
begin
    foreach c in array array['npm = ''88009''', 'jenis = ''sidang''', 'prodi = ''s2'''] loop
        begin
            execute format('update defenses set %s where id = $1', c) using pras1;
            raise exception 'FAIL: changed a graded prasidang: %', c;
        exception when raise_exception then
            assert sqlerrm = 'Mahasiswa tidak dapat diubah: prasidang ini sudah dinilai.', sqlerrm;
        end;
    end loop;
    update defenses set npm = npm, jenis = jenis, prodi = prodi, jam_mulai = '08:30' where id = pras1;
    update defenses set npm = '88012' where id = pras2;
    update defenses set npm = '88002' where id = pras2;
end $$;

-- Super Admin renames a graded lecturer's kode: the FK cascade still reaches nilai_bimbingan
-- although authenticated may update only aspek and nilai there (FK actions run as the owner).
select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
update lecturers set kode_dosen = 'DSN01Y' where kode_dosen = 'DSN01';
reset role;
do $$ begin
    assert (select count(*) from nilai_bimbingan where kode_dosen = 'DSN01Y') = 3, 'grades follow a Super Admin kode rename';
    assert (select kode_dosen from profiles where id = '00000000-0000-0000-0000-000000000006') = 'DSN01Y', 'the DOSEN account follows too';
end $$;
update lecturers set kode_dosen = 'DSN01' where kode_dosen = 'DSN01Y';

-- Nilai Sidang: EKSTERNAL day accounts, three examiners, Ketua lock ------------------------------
-- "Today" is the Jakarta date (R1). sd1 today: ketua DSN01, anggota_1 EXT01 (eksternal), anggota_2
-- DSN02. sd2 the day after tomorrow, sd3 yesterday, sd4 today with ketua DSN03, sd0 old.
\set eks '00000000-0000-0000-0000-000000000007'
\set dosen3 '00000000-0000-0000-0000-000000000008'
\set eksLama '00000000-0000-0000-0000-000000000009'
insert into lecturers (kode_dosen, nama, eksternal) values ('EXT01', 'Penguji Luar', true);
insert into auth.users (id, email) values (:'dosen3', 'dosen3@test'), (:'eksLama', 'eks-lama@penguji.local');
update profiles set role = 'DOSEN', kode_dosen = 'DSN02' where id = :'dosen3';
update profiles set role = 'EKSTERNAL', kode_dosen = 'EXT01', berlaku_sampai = (now() at time zone 'Asia/Jakarta')::date + 1
where id = :'eks';
insert into akun_eksternal (user_id, kode_dosen, tanggal, username)
values (:'eks', 'EXT01', (now() at time zone 'Asia/Jakarta')::date, 'eks-EXT01-hari-ini');
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, npm, nama_mahasiswa, penguji_kode, penguji_eksternal_kode, pembimbing_kode, prodi)
select 'R0002', 'sidang', (now() at time zone 'Asia/Jakarta')::date + d, jam::time, (jam::time + interval '1 hour')::time, npm, npm, ketua, 'EXT01', 'DSN02', 's1'
from (values ('88100', 0, '08:00', 'DSN01'), ('88102', 2, '09:00', 'DSN01'), ('88103', -1, '10:00', 'DSN01'),
             ('88104', 0, '11:00', 'DSN03'), ('88105', -40, '12:00', 'DSN01')) v(npm, d, jam, ketua);
-- The EKSTERNAL's own kode on a prasidang: bimbingan stays DOSEN-only.
insert into defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, pembimbing_kode, penguji_kode, prodi)
values ('R0002', 'prasidang', (now() at time zone 'Asia/Jakarta')::date - 1, '13:00', '14:00', 1, '88106', '88106', 'EXT01', 'DSN03', 's1');
create temp table sd_def as
    select case npm when '88100' then 'sd1' when '88102' then 'sd2' when '88103' then 'sd3' when '88104' then 'sd4'
                    when '88105' then 'sd0' else 'prasEks' end as k, id
    from defenses where npm in ('88100', '88102', '88103', '88104', '88105', '88106');
grant select on sd_def to authenticated;
insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, sumber)
values ((select id from sd_def where k = 'prasEks'), 'EXT01', 'pembimbing_1', '[{"label": "A", "bobot": 100, "skor": 60}]', 60, 'manual');

do $$ begin
    assert (select count(*) from aturan_penilaian where prodi = 's1' and kunci in ('aspek_sidang', 'pilihan_yudisium')) = 2, 'sidang rules seeded';
    assert (select sum((a ->> 'bobot')::int) from aturan_penilaian, jsonb_array_elements(nilai) a
            where prodi = 's1' and kunci = 'aspek_sidang') = 100, 'aspek sidang bobot sums to 100';
    assert (select jsonb_array_length(nilai) from aturan_penilaian where prodi = 's1' and kunci = 'aspek_sidang') = 7, 'seven sidang aspek';
    assert (select string_agg(y ->> 'label' || ':' || (y ->> 'lulus'), ',') from aturan_penilaian, jsonb_array_elements(nilai) y
            where prodi = 's1' and kunci = 'pilihan_yudisium')
           = 'Lulus Tanpa Revisi:true,Lulus Dengan Revisi:true,Tidak Lulus:false', 'default yudisium choices';
    -- An EKSTERNAL always has a lecturer and an expiry; nobody else has an expiry.
    begin
        update profiles set berlaku_sampai = null where id = '00000000-0000-0000-0000-000000000007';
        raise exception 'FAIL: an EKSTERNAL without berlaku_sampai';
    exception when check_violation then null;
    end;
    begin
        update profiles set kode_dosen = null where id = '00000000-0000-0000-0000-000000000007';
        raise exception 'FAIL: an EKSTERNAL without kode_dosen';
    exception when check_violation then null;
    end;
    begin
        update profiles set berlaku_sampai = current_date where id = '00000000-0000-0000-0000-000000000008';
        raise exception 'FAIL: a DOSEN with berlaku_sampai';
    exception when check_violation then null;
    end;
    begin
        insert into akun_eksternal (user_id, kode_dosen, tanggal, username)
        values ('00000000-0000-0000-0000-000000000009', 'EXT01', (now() at time zone 'Asia/Jakarta')::date, 'eks-lain');
        raise exception 'FAIL: two day accounts for one (dosen, tanggal)';
    exception when unique_violation then null;
    end;
    -- The admin client and the column grants (hardening pattern).
    assert has_table_privilege('service_role', 'nilai_sidang', 'select'), 'service_role reads nilai_sidang';
    assert has_table_privilege('service_role', 'hasil_sidang', 'select'), 'service_role reads hasil_sidang';
    assert has_column_privilege('service_role', 'hasil_sidang', 'email_status', 'update'), 'service_role writes email_status';
    assert has_column_privilege('service_role', 'hasil_sidang', 'email_detail', 'update'), 'service_role writes email_detail';
    assert has_table_privilege('service_role', 'akun_eksternal', 'select'), 'service_role reads akun_eksternal';
    assert has_table_privilege('service_role', 'akun_eksternal', 'insert'), 'service_role creates akun_eksternal';
    assert has_table_privilege('service_role', 'akun_eksternal', 'update'), 'service_role updates akun_eksternal';
    assert not has_table_privilege('authenticated', 'akun_eksternal', 'insert'), 'authenticated never creates a day account';
    assert not has_table_privilege('authenticated', 'akun_eksternal', 'update'), 'authenticated never edits a day account';
    assert not has_table_privilege('authenticated', 'nilai_sidang', 'update'), 'nilai_sidang has no table-wide update';
    assert has_column_privilege('authenticated', 'nilai_sidang', 'aspek', 'update'), 'authenticated updates aspek';
    assert has_column_privilege('authenticated', 'nilai_sidang', 'nilai', 'update'), 'authenticated updates nilai';
    assert has_column_privilege('authenticated', 'nilai_sidang', 'ada_revisi', 'update'), 'authenticated updates ada_revisi';
    assert has_column_privilege('authenticated', 'nilai_sidang', 'revisi', 'update'), 'authenticated updates revisi';
    assert not has_column_privilege('authenticated', 'nilai_sidang', 'peran', 'update'), 'peran is fixed';
    assert not has_column_privilege('authenticated', 'nilai_sidang', 'kode_dosen', 'update'), 'kode_dosen is fixed';
    assert not has_column_privilege('authenticated', 'nilai_sidang', 'submitted_at', 'update'), 'submitted_at is fixed';
    assert not has_table_privilege('authenticated', 'hasil_sidang', 'update'), 'hasil_sidang has no table-wide update';
    assert has_column_privilege('authenticated', 'hasil_sidang', 'yudisium_label', 'update'), 'authenticated updates yudisium_label';
    assert has_column_privilege('authenticated', 'hasil_sidang', 'yudisium_lulus', 'update'), 'authenticated updates yudisium_lulus';
    assert not has_column_privilege('authenticated', 'hasil_sidang', 'email_status', 'update'), 'email_status is the server''s';
    assert not has_column_privilege('authenticated', 'hasil_sidang', 'aturan', 'update'), 'the frozen rules stay';
    assert not has_function_privilege('authenticated', 'purge_expired_eksternal()', 'execute'), 'authenticated cannot purge accounts';
    assert not has_function_privilege('anon', 'purge_expired_eksternal()', 'execute'), 'anon cannot purge accounts';
end $$;

-- The active EKSTERNAL: no staff data, no bimbingan, reads the rules.
select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$
declare n int;
begin
    select count(*) into n from defenses;
    assert n = 0, 'EKSTERNAL reads defenses: ' || n;
    select count(*) into n from students;
    assert n = 0, 'EKSTERNAL reads students: ' || n;
    select count(*) into n from audit_log;
    assert n = 0, 'EKSTERNAL reads audit_log: ' || n;
    assert (select count(*) from akun_eksternal) = 0, 'EKSTERNAL reads no day accounts';
    assert (select count(*) from profiles) = 1, 'EKSTERNAL reads only its own profile';
    assert is_eksternal_aktif(), 'the day account is active';
    assert my_kode_dosen() is null, 'my_kode_dosen() stays DOSEN-only';
    assert my_kode_penguji() = 'EXT01', 'my_kode_penguji() is the EKSTERNAL''s lecturer';
    assert (select count(*) from aturan_penilaian) = 7, 'an active EKSTERNAL reads the rules';
    assert (select count(*) from nilai_bimbingan) = 0, 'an EKSTERNAL reads no bimbingan grade, not even its own kode';
    begin
        insert into nilai_bimbingan (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'prasEks'), 'EXT01', 'pembimbing_1', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
        raise exception 'FAIL: an EKSTERNAL graded bimbingan';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;

-- The Ketua grades last.
select set_config('request.jwt.claim.sub', :'dosen', false);
set role authenticated;
do $$ begin
    assert my_kode_penguji() = 'DSN01', 'my_kode_penguji() is a DOSEN''s lecturer too';
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'sd1'), 'DSN01', 'ketua', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
        raise exception 'FAIL: the Ketua graded before the anggota';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$
declare
    sd1 uuid := (select id from sd_def where k = 'sd1');
    a jsonb := '[{"label": "A", "bobot": 100, "skor": 80}]';
    r record;
begin
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values (sd1, 'EXT01', 'anggota_2', a, 80, auth.uid());
        raise exception 'FAIL: an examiner graded as another peran';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, submitted_by)
        values (sd1, 'EXT01', 'anggota_1', a, 80, false, '[{"halaman":"1","catatan":"x"}]', auth.uid());
        raise exception 'FAIL: revisi without ada_revisi';
    exception when check_violation then null;
    end;
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, submitted_by)
        values (sd1, 'EXT01', 'anggota_1', a, 80, true, '[]', auth.uid());
        raise exception 'FAIL: ada_revisi without revisi';
    exception when check_violation then null;
    end;
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, submitted_by)
        values (sd1, 'EXT01', 'anggota_1', a, 80, true, '[{"halaman":"1","catatan":"  "}]', auth.uid());
        raise exception 'FAIL: a revisi row without catatan';
    exception when check_violation then null;
    end;
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values (sd1, 'EXT01', 'anggota_1', '[{"label": "A", "bobot": 50, "skor": 80}]', 40, auth.uid());
        raise exception 'FAIL: aspek bobot not 100';
    exception when check_violation then null;
    end;
    -- The DB computes nilai and the timestamps.
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, submitted_at, created_at, submitted_by)
    values (sd1, 'EXT01', 'anggota_1', '[{"label": "A", "bobot": 40, "skor": 75.5}, {"label": "B", "bobot": 60, "skor": 77}]', 1,
            true, '[{"halaman": "12", "catatan": "Perbaiki tabel"}, {"catatan": "Tambah saran"}]', '2020-01-01', '2020-01-01', auth.uid());
    select nilai, submitted_at, created_at into r from nilai_sidang where defense_id = sd1;
    assert r.nilai = 76.40, 'nilai recomputed from aspek: ' || r.nilai;
    assert r.submitted_at > now() - interval '1 minute', 'submitted_at is the insert time';
    assert r.created_at > now() - interval '1 minute', 'created_at is the insert time';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'dosen3', false);
set role authenticated;
do $$
declare a jsonb := '[{"label": "A", "bobot": 100, "skor": 70}]';
begin
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'sd2'), 'DSN02', 'anggota_2', a, 70, auth.uid());
        raise exception 'FAIL: graded before the sidang date';
    exception when insufficient_privilege then null;
    end;
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
    values ((select id from sd_def where k = 'sd1'), 'DSN02', 'anggota_2', a, 70, auth.uid());
    assert (select count(*) from nilai_sidang) = 1, 'anggota_2 reads only its own grade';
    begin
        insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_by)
        values ((select id from sd_def where k = 'sd1'), 'Lulus Tanpa Revisi', true, '{}', auth.uid());
        raise exception 'FAIL: an anggota locked the sidang';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'dosen', false);
set role authenticated;
do $$
declare sd1 uuid := (select id from sd_def where k = 'sd1'); r record;
begin
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
    values (sd1, 'DSN01', 'ketua', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
    assert (select count(*) from nilai_sidang where defense_id = sd1) = 3, 'the Ketua reads all three grades';
    assert (select count(*) from hasil_sidang) = 0, 'not locked yet';
    begin
        insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_by)
        values (sd1, 'Tidak Lulus', true, '{}', auth.uid());
        raise exception 'FAIL: a yudisium pair outside pilihan_yudisium';
    exception when check_violation then null;
    end;
    begin
        insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_by)
        values (sd1, 'Lulus Bersyarat', true, '{}', auth.uid());
        raise exception 'FAIL: a yudisium label outside pilihan_yudisium';
    exception when check_violation then null;
    end;
    -- The client's rules and email fields are ignored: the DB freezes the current rules.
    insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_at, locked_by, email_status, email_detail)
    values (sd1, 'Lulus Dengan Revisi', true,
            '{"tabelNilai": [{"min": 0, "huruf": "A", "mutu": 4}], "predikat": [], "sksSkripsi": 99}',
            '2020-01-01', auth.uid(), 'terkirim', '[{"email": "x@y.id", "ok": true}]');
    select * into r from hasil_sidang where defense_id = sd1;
    assert r.locked_at > now() - interval '1 minute', 'locked_at is the lock time';
    assert r.aturan = jsonb_build_object(
        'tabelNilai', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'tabel_nilai'),
        'predikat', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'predikat'),
        'sksSkripsi', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'sks_skripsi')), 'aturan frozen from the rules: ' || r.aturan;
    assert r.aturan -> 'sksSkripsi' = '6'::jsonb, 'the seeded sks skripsi';
    assert r.email_status = 'menunggu', 'a sidang with revisi waits for its email: ' || r.email_status;
    assert r.email_detail = '[]'::jsonb, 'email_detail starts empty';
end $$;
reset role;

-- After lock: nobody but Super Admin changes anything.
select set_config('request.jwt.claim.sub', :'dosen3', false);
set role authenticated;
do $$
declare n int;
begin
    assert (select count(*) from hasil_sidang) = 1, 'an examiner reads the result';
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'sd1'), 'DSN02', 'anggota_2', '[{"label": "A", "bobot": 100, "skor": 90}]', 90, auth.uid());
        raise exception 'FAIL: an anggota graded after lock';
    exception when insufficient_privilege then null;
    end;
    update nilai_sidang set aspek = '[{"label": "A", "bobot": 100, "skor": 90}]';
    get diagnostics n = row_count;
    assert n = 0, 'an anggota never edits a grade';
    update hasil_sidang set yudisium_label = 'Tidak Lulus';
    get diagnostics n = row_count;
    assert n = 0, 'an anggota never edits the result';
end $$;
reset role;

select set_config('request.jwt.claim.sub', :'super', false);
set role authenticated;
do $$
declare
    sd1 uuid := (select id from sd_def where k = 'sd1');
    sd0 uuid := (select id from sd_def where k = 'sd0');
    a jsonb := '[{"label": "A", "bobot": 100, "skor": 70}]';
    c text;
    n int;
begin
    update nilai_sidang set aspek = '[{"label": "A", "bobot": 100, "skor": 85}]', ada_revisi = false, revisi = '[]'
    where defense_id = sd1 and peran = 'anggota_1';
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin edits a locked grade';
    assert (select nilai from nilai_sidang where defense_id = sd1 and peran = 'anggota_1') = 85, 'an edit recomputes nilai';
    update hasil_sidang set yudisium_label = 'Lulus Tanpa Revisi', yudisium_lulus = true where defense_id = sd1;
    get diagnostics n = row_count;
    assert n = 1, 'Super Admin edits the yudisium';
    begin
        update hasil_sidang set yudisium_label = 'Tidak Lulus', yudisium_lulus = true where defense_id = sd1;
        raise exception 'FAIL: Super Admin saved a yudisium pair outside pilihan_yudisium';
    exception when check_violation then null;
    end;
    foreach c in array array['peran', 'kode_dosen', 'sumber', 'submitted_by'] loop
        begin
            execute format('update nilai_sidang set %I = %I where defense_id = $1', c, c) using sd1;
            raise exception 'FAIL: Super Admin updated nilai_sidang.%', c;
        exception when insufficient_privilege then null;
        end;
    end loop;
    foreach c in array array['email_status', 'aturan', 'locked_by'] loop
        begin
            execute format('update hasil_sidang set %I = %I where defense_id = $1', c, c) using sd1;
            raise exception 'FAIL: Super Admin updated hasil_sidang.%', c;
        exception when insufficient_privilege then null;
        end;
    end loop;
    assert not has_table_privilege('authenticated', 'nilai_sidang', 'delete'), 'nobody deletes a sidang grade';
    assert not has_table_privilege('authenticated', 'hasil_sidang', 'delete'), 'nobody unlocks a sidang';
    -- Manual grades only on an old sidang, then the lock on the Ketua's behalf.
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, sumber, submitted_by)
        values ((select id from sd_def where k = 'sd3'), 'DSN02', 'anggota_2', a, 70, 'manual', auth.uid());
        raise exception 'FAIL: a manual grade on a new sidang';
    exception when insufficient_privilege then null;
    end;
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, sumber, submitted_by)
    values (sd0, 'EXT01', 'anggota_1', a, 70, 'manual', auth.uid()), (sd0, 'DSN02', 'anggota_2', a, 70, 'manual', auth.uid());
    update nilai_sidang set ada_revisi = true, revisi = '[{"catatan": "Perbaiki abstrak"}]' where defense_id = sd0 and peran = 'anggota_1';
    begin
        insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_by)
        values (sd0, 'Lulus Tanpa Revisi', true, '{}', auth.uid());
        raise exception 'FAIL: locked an old sidang with a grade missing';
    exception when insufficient_privilege then null;
    end;
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, sumber, submitted_by)
    values (sd0, 'DSN01', 'ketua', a, 70, 'manual', auth.uid());
    insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, locked_by, email_status)
    values (sd0, 'Lulus Tanpa Revisi', true, '{}', auth.uid(), 'menunggu');
    assert (select email_status from hasil_sidang where defense_id = sd0) = 'tidak_perlu', 'an old sidang sends no email, revisi or not';
end $$;
reset role;

-- A graded sidang keeps its examiners, date and student.
insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, sumber)
values ((select id from sd_def where k = 'sd3'), 'DSN02', 'anggota_2', '[{"label": "A", "bobot": 100, "skor": 70}]', 70, 'manual');
do $$
declare
    sd1 uuid := (select id from sd_def where k = 'sd1');
    sd3 uuid := (select id from sd_def where k = 'sd3');
    c text;
begin
    foreach c in array array['tanggal = tanggal + 1', 'penguji_kode = ''DSN03''', 'penguji_eksternal_kode = ''DSN03''', 'pembimbing_kode = ''DSN03'''] loop
        begin
            execute format('update defenses set %s where id = $1', c) using sd1;
            raise exception 'FAIL: changed a graded sidang: %', c;
        exception when raise_exception then
            assert sqlstate = 'P0001', sqlstate;
            assert sqlerrm = 'Penguji/tanggal tidak dapat diubah: sidang ini sudah dinilai.', sqlerrm;
        end;
    end loop;
    foreach c in array array['npm = ''88199''', 'jenis = ''prasidang'', kelompok = 1', 'prodi = ''s2'''] loop
        begin
            execute format('update defenses set %s where id = $1', c) using sd1;
            raise exception 'FAIL: changed a graded sidang''s student: %', c;
        exception when raise_exception then
            assert sqlerrm like '%sudah dinilai.', sqlerrm;
        end;
    end loop;
    update defenses set jam_mulai = '08:15' where id = sd1;
    -- sd3 has only anggota_2: the other examiners still change, the date and anggota_2 don't.
    update defenses set penguji_kode = 'DSN03', penguji_eksternal_kode = null where id = sd3;
    begin
        update defenses set pembimbing_kode = 'DSN03', penguji_kode = 'DSN01' where id = sd3;
        raise exception 'FAIL: changed a graded anggota_2';
    exception when raise_exception then null;
    end;
    begin
        update defenses set tanggal = tanggal - 1 where id = sd3;
        raise exception 'FAIL: moved a graded sidang';
    exception when raise_exception then null;
    end;
    begin
        delete from defenses where id = sd1;
        raise exception 'FAIL: deleted a graded sidang';
    exception when foreign_key_violation then null;
    end;
    -- Renaming a lecturer's kode is not a reassignment.
    update lecturers set kode_dosen = 'EXT01X' where kode_dosen = 'EXT01';
    assert (select kode_dosen from nilai_sidang where defense_id = sd1 and peran = 'anggota_1') = 'EXT01X', 'sidang grade follows the renamed kode';
    update lecturers set kode_dosen = 'EXT01' where kode_dosen = 'EXT01X';
    assert exists (select 1 from audit_log where table_name = 'nilai_sidang'), 'sidang grades are audited';
    assert exists (select 1 from audit_log where table_name = 'hasil_sidang'), 'the lock is audited';
    assert exists (select 1 from audit_log where table_name = 'akun_eksternal'), 'day accounts are audited';
    assert exists (select 1 from audit_log where table_name = 'profiles' and record_id = '00000000-0000-0000-0000-000000000007'), 'profile changes are audited';
end $$;

-- A new sidang with no revisi anywhere sends no email.
insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, sumber)
select (select id from sd_def where k = 'sd3'), kode, peran, '[{"label": "A", "bobot": 100, "skor": 70}]', 70, 'manual'
from (values ('DSN03', 'ketua'), ('EXT01', 'anggota_1')) v(kode, peran);
insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, aturan, email_status)
values ((select id from sd_def where k = 'sd3'), 'Lulus Tanpa Revisi', true, '{}', 'gagal');
do $$ begin
    assert (select email_status from hasil_sidang where defense_id = (select id from sd_def where k = 'sd3')) = 'tidak_perlu',
        'no revisi, no email';
end $$;

-- Expiry at the Jakarta boundary, then the day check.
update profiles set berlaku_sampai = (now() at time zone 'Asia/Jakarta')::date where id = :'eks';
select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$ begin
    assert is_eksternal_aktif(), 'active through berlaku_sampai (Jakarta)';
end $$;
reset role;
update profiles set berlaku_sampai = (now() at time zone 'Asia/Jakarta')::date - 1 where id = :'eks';
select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$ begin
    assert not is_eksternal_aktif(), 'expired the day after berlaku_sampai';
    assert my_kode_penguji() is null, 'an expired EKSTERNAL has no kode';
    assert (select count(*) from aturan_penilaian) = 0, 'an expired EKSTERNAL reads no rules';
    assert (select count(*) from nilai_sidang) = 0, 'an expired EKSTERNAL reads no grades';
    assert (select count(*) from hasil_sidang) = 0, 'an expired EKSTERNAL reads no result';
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'sd4'), 'EXT01', 'anggota_1', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
        raise exception 'FAIL: an expired EKSTERNAL graded';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;
update profiles set berlaku_sampai = (now() at time zone 'Asia/Jakarta')::date + 1 where id = :'eks';
update akun_eksternal set tanggal = (now() at time zone 'Asia/Jakarta')::date - 3 where user_id = :'eks';
select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$ begin
    assert (select count(*) from nilai_sidang) = 0, 'another day''s account reads no grade';
    begin
        insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
        values ((select id from sd_def where k = 'sd4'), 'EXT01', 'anggota_1', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
        raise exception 'FAIL: another day''s account graded';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;
update akun_eksternal set tanggal = (now() at time zone 'Asia/Jakarta')::date where user_id = :'eks';
select set_config('request.jwt.claim.sub', :'eks', false);
set role authenticated;
do $$ begin
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
    values ((select id from sd_def where k = 'sd4'), 'EXT01', 'anggota_1', '[{"label": "A", "bobot": 100, "skor": 80}]', 80, auth.uid());
    assert (select count(*) from nilai_sidang) = 2, 'the day account reads its day''s grades';
end $$;
reset role;

-- The nightly cleanup deletes day accounts expired more than 30 days, nothing else.
update profiles set role = 'EKSTERNAL', kode_dosen = 'EXT01', berlaku_sampai = (now() at time zone 'Asia/Jakarta')::date - 31
where id = :'eksLama';
insert into akun_eksternal (user_id, kode_dosen, tanggal, username)
values (:'eksLama', 'EXT01', (now() at time zone 'Asia/Jakarta')::date - 32, 'eks-EXT01-lama');
select set_config('request.jwt.claim.sub', '', false);
select purge_expired_eksternal();
do $$ begin
    assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000009'), 'an old day account is deleted';
    assert not exists (select 1 from akun_eksternal where user_id = '00000000-0000-0000-0000-000000000009'), 'its akun_eksternal goes too';
    assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000007'), 'an active day account stays';
    assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000006'), 'a DOSEN stays';
end $$;

-- The Ketua's grade and the lock are one call (kunci_sidang): both commit or neither.
\set dosen4 '00000000-0000-0000-0000-000000000010'
insert into auth.users (id, email) values (:'dosen4', 'dosen4@test');
update profiles set role = 'DOSEN', kode_dosen = 'DSN03' where id = :'dosen4';
do $$ begin
    assert not has_function_privilege('anon', 'kunci_sidang(uuid, jsonb, boolean, jsonb, text, boolean)', 'execute'), 'anon cannot lock';
    assert has_function_privilege('authenticated', 'kunci_sidang(uuid, jsonb, boolean, jsonb, text, boolean)', 'execute'), 'an examiner calls kunci_sidang';
end $$;
select set_config('request.jwt.claim.sub', :'dosen3', false);
set role authenticated;
do $$
declare sd4 uuid := (select id from sd_def where k = 'sd4');
begin
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, submitted_by)
    values (sd4, 'DSN02', 'anggota_2', '[{"label": "A", "bobot": 100, "skor": 70}]', 70, auth.uid());
    begin
        perform kunci_sidang(sd4, '[{"label": "A", "bobot": 100, "skor": 70}]', false, '[]', 'Lulus Tanpa Revisi', true);
        raise exception 'FAIL: an anggota locked through kunci_sidang';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', :'dosen4', false);
set role authenticated;
do $$
declare
    sd4 uuid := (select id from sd_def where k = 'sd4');
    a jsonb := '[{"label": "A", "bobot": 40, "skor": 90}, {"label": "B", "bobot": 60, "skor": 80}]';
    s text;
begin
    begin
        perform kunci_sidang(sd4, a, false, '[]', 'Lulus Bersyarat', true);
        raise exception 'FAIL: kunci_sidang took a yudisium outside pilihan_yudisium';
    exception when check_violation then null;
    end;
    s := kunci_sidang(sd4, a, true, '[{"halaman": "", "catatan": "Perbaiki abstrak"}]', 'Lulus Dengan Revisi', true);
    assert s = 'menunggu', 'kunci_sidang returns the email status: ' || s;
    assert (select nilai from nilai_sidang where defense_id = sd4 and peran = 'ketua' and kode_dosen = 'DSN03') = 84, 'the Ketua grade is stored and scored';
    assert (select yudisium_label from hasil_sidang where defense_id = sd4) = 'Lulus Dengan Revisi', 'and the sidang is locked';
    begin
        perform kunci_sidang(sd4, a, false, '[]', 'Lulus Tanpa Revisi', true);
        raise exception 'FAIL: locked twice';
    exception when insufficient_privilege then null;
    end;
end $$;
reset role;
