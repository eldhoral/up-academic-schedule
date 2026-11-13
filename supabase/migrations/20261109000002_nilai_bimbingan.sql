-- ==============================================================================
-- Migration: 20261109000002_nilai_bimbingan.sql
-- Description: Nilai Bimbingan. Mahasiswa and Dosen master fields, the S1
-- grading rules (aturan_penilaian), one grade per (prasidang, peran) in
-- nilai_bimbingan, and a lock that keeps a graded prasidang's dosen fixed.
-- A DOSEN inserts only its own grade, from the prasidang date onward, once;
-- Super Admin edits grades and enters only old ones (sumber = 'manual').
-- ==============================================================================

-- 1. Master fields -----------------------------------------------------------------
-- SKS and Bobot before sidang are typed from the transcript; IPK = bobot / sks is derived.
alter table students
    add column if not exists sks_sebelum smallint null check (sks_sebelum > 0),
    add column if not exists bobot_sebelum numeric(7,2) null check (bobot_sebelum >= 0),
    add column if not exists tepat_waktu boolean not null default false,
    add column if not exists email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
alter table students drop constraint if exists chk_students_bobot_sebelum;
alter table students add constraint chk_students_bobot_sebelum
    check (bobot_sebelum is null or sks_sebelum is null or bobot_sebelum <= 4 * sks_sebelum);

alter table lecturers
    add column if not exists email text not null default '' check (email = '' or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    add column if not exists eksternal boolean not null default false;

-- 2. Audit record id ---------------------------------------------------------------
-- Same as 20261008000003_jadwal_dosen.sql, plus kunci so a rule edit links to its history.
create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    old_j jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) - 'jadwal_token' else null end;
    new_j jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) - 'jadwal_token' else null end;
    rid text := coalesce(
        new_j ->> 'id', old_j ->> 'id',
        new_j ->> 'kode_mk', old_j ->> 'kode_mk',
        new_j ->> 'kode_dosen', old_j ->> 'kode_dosen',
        new_j ->> 'key', old_j ->> 'key',
        new_j ->> 'kunci', old_j ->> 'kunci'
    );
    actor uuid := auth.uid();
    actor_mail text;
begin
    if actor is not null then
        select email into actor_mail from auth.users where id = actor;
    end if;

    insert into audit_log (actor_id, actor_email, action, table_name, record_id, old_data, new_data)
    values (actor, actor_mail, TG_OP, TG_TABLE_NAME, rid, old_j, new_j);

    return coalesce(NEW, OLD);
end;
$$;

-- 3. Grading rules -----------------------------------------------------------------
-- One jsonb value per rule; the TS module validates the shape. The sidang design adds kunci.
create table if not exists aturan_penilaian (
    prodi varchar(2) not null check (prodi in ('s1', 's2')),
    kunci text not null constraint chk_aturan_penilaian_kunci
        check (kunci in ('aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian')),
    nilai jsonb not null,
    updated_at timestamptz not null default timezone('utc'::text, now()),
    updated_by uuid default auth.uid() references auth.users(id) on delete set null,
    primary key (prodi, kunci)
);

create or replace function set_aturan_penilaian_updated()
returns trigger
language plpgsql
as $$
begin
    NEW.updated_at := timezone('utc'::text, now());
    NEW.updated_by := auth.uid();
    return NEW;
end;
$$;

drop trigger if exists update_aturan_penilaian_updated on aturan_penilaian;
create trigger update_aturan_penilaian_updated
    before update on aturan_penilaian
    for each row execute function set_aturan_penilaian_updated();

drop trigger if exists audit_aturan_penilaian on aturan_penilaian;
create trigger audit_aturan_penilaian
    after insert or update or delete on aturan_penilaian
    for each row execute function audit_row();

alter table aturan_penilaian enable row level security;

drop policy if exists aturan_penilaian_select on aturan_penilaian;
create policy aturan_penilaian_select on aturan_penilaian for select to authenticated
    using ((select is_staff()) or (select my_kode_dosen()) is not null);
drop policy if exists aturan_penilaian_insert on aturan_penilaian;
create policy aturan_penilaian_insert on aturan_penilaian for insert to authenticated with check (is_superadmin());
drop policy if exists aturan_penilaian_update on aturan_penilaian;
create policy aturan_penilaian_update on aturan_penilaian for update to authenticated using (is_superadmin()) with check (is_superadmin());
drop policy if exists aturan_penilaian_delete on aturan_penilaian;
create policy aturan_penilaian_delete on aturan_penilaian for delete to authenticated using (is_superadmin());

grant select, insert, update, delete on aturan_penilaian to authenticated;

-- Defaults from the DOSPEM I sheet and the faculty Nilai/predikat tables.
-- The start date is the day this runs (Jakarta): earlier prasidang count as old.
insert into aturan_penilaian (prodi, kunci, nilai) values
    ('s1', 'aspek_bimbingan', '[
        {"label": "Proses Pengerjaan Skripsi", "bobot": 30, "sub": [
            "Kemampuan belajar dan bekerja independen (mandiri)",
            "Kemampuan membuat perencanaan dan menjalankan",
            "Kerja tim pembimbing dan mahasiswa",
            "Sikap dan perilaku saat proses bimbingan"]},
        {"label": "Pemahaman Penelitian", "bobot": 30, "sub": [
            "Kemampuan mendefinisikan masalah",
            "Pemahaman teori",
            "Ketepatan metode",
            "Kualitas hasil penelitian",
            "Ketepatan penarikan kesimpulan",
            "Aplikasi dan spesifikasi saran"]},
        {"label": "Kajian Pustaka", "bobot": 20, "sub": [
            "Relevansi",
            "Kemutakhiran (70% literatur 10 tahun terakhir)",
            "Penyusunan daftar pustaka",
            "Kedalaman dan keluasan pustaka pendukung"]},
        {"label": "Sistematika Penulisan", "bobot": 20, "sub": [
            "Bahasa dan tata tulis sesuai kaidah Bahasa Indonesia dan APA"]}
    ]'::jsonb),
    ('s1', 'tabel_nilai', '[
        {"min": 80, "huruf": "A", "mutu": 4.00},
        {"min": 76, "huruf": "A-", "mutu": 3.67},
        {"min": 72, "huruf": "B+", "mutu": 3.33},
        {"min": 68, "huruf": "B", "mutu": 3.00},
        {"min": 64, "huruf": "B-", "mutu": 2.67},
        {"min": 60, "huruf": "C+", "mutu": 2.33},
        {"min": 56, "huruf": "C", "mutu": 2.00},
        {"min": 45, "huruf": "D", "mutu": 1.00},
        {"min": 0, "huruf": "E", "mutu": 0.00}
    ]'::jsonb),
    ('s1', 'predikat', '[
        {"min": 2.00, "max": 2.75, "predikat": "Memuaskan", "butuhTepatWaktu": false},
        {"min": 2.76, "max": 3.50, "predikat": "Sangat Memuaskan", "butuhTepatWaktu": false},
        {"min": 3.51, "max": 4.00, "predikat": "Dengan Pujian", "butuhTepatWaktu": true}
    ]'::jsonb),
    ('s1', 'sks_skripsi', '6'::jsonb),
    ('s1', 'tanggal_mulai_penilaian', to_jsonb(to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')))
on conflict (prodi, kunci) do nothing;

-- 4. Grades --------------------------------------------------------------------------
-- Peran on an S1 prasidang: pembimbing_1 = defenses.pembimbing_kode, pembimbing_2 = penguji_kode.
-- aspek is the snapshot [{label, bobot, skor}] the grade was made under; nilai is computed from it.
create table if not exists nilai_bimbingan (
    id uuid primary key default gen_random_uuid(),
    defense_id uuid not null references defenses(id) on delete restrict,
    kode_dosen varchar(30) not null references lecturers(kode_dosen) on update cascade,
    peran text not null check (peran in ('pembimbing_1', 'pembimbing_2')),
    aspek jsonb not null check (jsonb_typeof(aspek) = 'array'),
    nilai numeric(5,2) not null check (nilai between 0 and 100),
    sumber text not null default 'dosen' check (sumber in ('dosen', 'manual')),
    submitted_at timestamptz not null default timezone('utc'::text, now()),
    submitted_by uuid default auth.uid() references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    unique (defense_id, peran)
);

drop trigger if exists update_nilai_bimbingan_updated_at on nilai_bimbingan;
create trigger update_nilai_bimbingan_updated_at
    before update on nilai_bimbingan
    for each row execute function update_updated_at_column();

drop trigger if exists audit_nilai_bimbingan on nilai_bimbingan;
create trigger audit_nilai_bimbingan
    after insert or update or delete on nilai_bimbingan
    for each row execute function audit_row();

-- The caller is the DOSEN holding that peran on an S1 prasidang dated today (Jakarta) or earlier.
-- my_kode_dosen() is null for every role but DOSEN, so staff and day accounts never pass.
create or replace function may_grade_bimbingan(p_defense uuid, p_peran text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from defenses d
        where d.id = p_defense
          and d.prodi = 's1' and d.jenis = 'prasidang'
          and my_kode_dosen() = case p_peran when 'pembimbing_1' then d.pembimbing_kode
                                             when 'pembimbing_2' then d.penguji_kode end
          and (now() at time zone 'Asia/Jakarta')::date >= d.tanggal
    )
$$;

-- Super Admin on an S1 prasidang dated before tanggal_mulai_penilaian.
create or replace function may_enter_old_bimbingan(p_defense uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select is_superadmin() and exists (
        select 1 from defenses d
        where d.id = p_defense
          and d.prodi = 's1' and d.jenis = 'prasidang'
          and d.tanggal < (select (nilai #>> '{}')::date from aturan_penilaian
                           where prodi = 's1' and kunci = 'tanggal_mulai_penilaian')
    )
$$;

alter table nilai_bimbingan enable row level security;

drop policy if exists nilai_bimbingan_select on nilai_bimbingan;
create policy nilai_bimbingan_select on nilai_bimbingan for select to authenticated
    using ((select is_staff()) or kode_dosen = (select my_kode_dosen()));
drop policy if exists nilai_bimbingan_insert on nilai_bimbingan;
create policy nilai_bimbingan_insert on nilai_bimbingan for insert to authenticated with check (
    (sumber = 'dosen' and may_grade_bimbingan(defense_id, peran)
        and kode_dosen = (select my_kode_dosen()) and submitted_by = auth.uid())
    or (sumber = 'manual' and may_enter_old_bimbingan(defense_id) and submitted_by = auth.uid())
);
drop policy if exists nilai_bimbingan_update on nilai_bimbingan;
create policy nilai_bimbingan_update on nilai_bimbingan for update to authenticated
    using (is_superadmin()) with check (is_superadmin());
-- No delete policy: nobody deletes a grade.

grant select, insert, update, delete on nilai_bimbingan to authenticated;

-- 5. Dosen lock ------------------------------------------------------------------------
-- A graded peran keeps its dosen. Renaming a lecturer's kode (on update cascade) is not a
-- reassignment: the old kode is gone from lecturers by then, and the grade follows it too.
create or replace function lock_graded_defense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (NEW.pembimbing_kode is distinct from OLD.pembimbing_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_kode)
            and exists (select 1 from nilai_bimbingan where defense_id = OLD.id and peran = 'pembimbing_1'))
        or (NEW.penguji_kode is distinct from OLD.penguji_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_kode)
            and exists (select 1 from nilai_bimbingan where defense_id = OLD.id and peran = 'pembimbing_2')) then
        raise exception 'Dosen pembimbing tidak dapat diubah: prasidang ini sudah dinilai.';
    end if;
    return NEW;
end;
$$;

drop trigger if exists lock_graded_defense on defenses;
create trigger lock_graded_defense
    before update of pembimbing_kode, penguji_kode on defenses
    for each row execute function lock_graded_defense();
