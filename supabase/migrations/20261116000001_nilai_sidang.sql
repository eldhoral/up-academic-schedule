-- ==============================================================================
-- Migration: 20261116000001_nilai_sidang.sql
-- Description: Nilai Sidang. Day logins for external examiners (EKSTERNAL),
-- the sidang rules, one grade per (S1 sidang, peran) in nilai_sidang, and the
-- Ketua's lock in hasil_sidang. The anggota grade first, then the Ketua grades
-- and locks; after that only Super Admin edits. A graded sidang keeps its
-- examiners, date and student. Follows the 20261109000003 hardening pattern.
-- ==============================================================================

-- 1. EKSTERNAL day accounts -----------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
    check (role in ('SUPERADMIN', 'SCHEDULER', 'VIEWER', 'DOSEN', 'EKSTERNAL'));

-- Last Jakarta day the login works: tanggal + 1, extended by Super Admin ("Perpanjang").
alter table profiles add column if not exists berlaku_sampai date null;
alter table profiles drop constraint if exists profiles_berlaku_sampai_check;
alter table profiles add constraint profiles_berlaku_sampai_check
    check ((role = 'EKSTERNAL') = (berlaku_sampai is not null));

alter table profiles drop constraint if exists profiles_kode_dosen_role_check;
alter table profiles add constraint profiles_kode_dosen_role_check
    check ((role in ('DOSEN', 'EKSTERNAL')) = (kode_dosen is not null));

-- Role, kode and expiry changes ("Perpanjang") land in the audit log.
drop trigger if exists audit_profiles on profiles;
create trigger audit_profiles
    after insert or update or delete on profiles
    for each row execute function audit_row();

-- One login per (external dosen, sidang date); every S1 sidang that day shares it.
create table if not exists akun_eksternal (
    user_id uuid primary key references auth.users(id) on delete cascade,
    kode_dosen varchar(30) not null references lecturers(kode_dosen) on update cascade,
    tanggal date not null,
    username text unique not null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    unique (kode_dosen, tanggal)
);

drop trigger if exists audit_akun_eksternal on akun_eksternal;
create trigger audit_akun_eksternal
    after insert or update or delete on akun_eksternal
    for each row execute function audit_row();

alter table akun_eksternal enable row level security;
drop policy if exists akun_eksternal_select on akun_eksternal;
create policy akun_eksternal_select on akun_eksternal for select to authenticated using ((select is_staff()));
-- No write policy: the admin client (service_role) creates and updates accounts.

create or replace function is_eksternal_aktif()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
        where id = auth.uid() and role = 'EKSTERNAL'
          and (now() at time zone 'Asia/Jakarta')::date <= berlaku_sampai
    )
$$;

-- The caller's lecturer for sidang grading: a DOSEN, or an EKSTERNAL that hasn't expired.
-- my_kode_dosen() stays DOSEN-only, so an EKSTERNAL never reads or grades bimbingan.
create or replace function my_kode_penguji()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
    select kode_dosen from profiles
    where id = auth.uid()
      and (role = 'DOSEN'
           or (role = 'EKSTERNAL' and (now() at time zone 'Asia/Jakarta')::date <= berlaku_sampai))
$$;

-- Expired day accounts stay (blocked) for 30 days, then the nightly job in
-- 20261116000002_eksternal_cleanup.sql deletes them. Grades keep submitted_by = null.
create or replace function purge_expired_eksternal()
returns void
language sql
security definer
set search_path = public
as $$
    delete from auth.users where id in (
        select p.id from profiles p join akun_eksternal a on a.user_id = p.id
        where p.role = 'EKSTERNAL' and p.berlaku_sampai < (now() at time zone 'Asia/Jakarta')::date - 30
    );
$$;
revoke execute on function purge_expired_eksternal() from public, anon, authenticated;

-- 2. Sidang rules ----------------------------------------------------------------------
alter table aturan_penilaian drop constraint if exists chk_aturan_penilaian_kunci;
alter table aturan_penilaian add constraint chk_aturan_penilaian_kunci
    check (kunci in ('aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian',
                     'aspek_sidang', 'pilihan_yudisium'));

drop policy if exists aturan_penilaian_select on aturan_penilaian;
create policy aturan_penilaian_select on aturan_penilaian for select to authenticated
    using ((select is_staff()) or (select my_kode_penguji()) is not null);

-- Defaults from the KETUA PENGUJI sheet.
insert into aturan_penilaian (prodi, kunci, nilai) values
    ('s1', 'aspek_sidang', '[
        {"label": "Permasalahan", "bobot": 20, "sub": [
            "Orisinalitas dan kemutakhiran topik",
            "Ketajaman perumusan masalah"]},
        {"label": "Kajian Pustaka", "bobot": 15, "sub": [
            "Relevansi",
            "Kemutakhiran (70% berasal dari literatur 10 tahun terakhir)",
            "Penyusunan daftar pustaka sesuai APA",
            "Kedalaman dan keluasan pustaka pendukung"]},
        {"label": "Metode Penelitian", "bobot": 15, "sub": [
            "Ketepatan metode yang digunakan",
            "Comprehensiveness dan kedetailan metode"]},
        {"label": "Hasil Penelitian yang Dicapai", "bobot": 15, "sub": [
            "Manfaat dan kontribusi",
            "Kesesuaian dengan tujuan",
            "Kualitas hasil penelitian"]},
        {"label": "Sistematika Penulisan", "bobot": 10, "sub": [
            "Bahasa dan tata tulis sesuai dengan kaidah Bahasa Indonesia dan APA",
            "Kesinambungan antar alinea dan bab"]},
        {"label": "Kesimpulan dan Saran", "bobot": 15, "sub": [
            "Ketepatan penarikan kesimpulan",
            "Aplikasi dan spesifikasi saran"]},
        {"label": "Presentasi", "bobot": 10, "sub": [
            "Nilai sikap",
            "Komunikasi",
            "Penguasaan isi skripsi",
            "Penguasaan materi lain yang relevan",
            "Argumentasi jawaban"]}
    ]'::jsonb),
    ('s1', 'pilihan_yudisium', '[
        {"label": "Lulus Tanpa Revisi", "lulus": true},
        {"label": "Lulus Dengan Revisi", "lulus": true},
        {"label": "Tidak Lulus", "lulus": false}
    ]'::jsonb)
on conflict (prodi, kunci) do nothing;

-- 3. Grades and the lock ----------------------------------------------------------------
-- Peran on an S1 sidang: ketua = penguji_kode, anggota_1 = penguji_eksternal_kode,
-- anggota_2 = pembimbing_kode. aspek is the snapshot [{label, bobot, skor}]; revisi is
-- [{halaman?, catatan}], empty unless ada_revisi.
create table if not exists nilai_sidang (
    id uuid primary key default gen_random_uuid(),
    defense_id uuid not null references defenses(id) on delete restrict,
    kode_dosen varchar(30) not null references lecturers(kode_dosen) on update cascade,
    peran text not null check (peran in ('ketua', 'anggota_1', 'anggota_2')),
    aspek jsonb not null check (jsonb_typeof(aspek) = 'array'),
    nilai numeric(5,2) not null check (nilai between 0 and 100),
    ada_revisi boolean not null default false,
    revisi jsonb not null default '[]'::jsonb,
    sumber text not null default 'dosen' check (sumber in ('dosen', 'manual')),
    submitted_at timestamptz not null default timezone('utc'::text, now()),
    submitted_by uuid default auth.uid() references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    unique (defense_id, peran)
);
alter table nilai_sidang drop constraint if exists chk_nilai_sidang_revisi;
alter table nilai_sidang add constraint chk_nilai_sidang_revisi check (ada_revisi = (revisi <> '[]'::jsonb));

-- One row per locked sidang. aturan is the frozen Tabel Nilai, predikat and sks_skripsi, set by
-- the DB at lock. email_* start from the DB too; the server (admin client) writes the outcome.
create table if not exists hasil_sidang (
    defense_id uuid primary key references defenses(id) on delete restrict,
    yudisium_label text not null,
    yudisium_lulus boolean not null,
    aturan jsonb not null,
    locked_at timestamptz not null default timezone('utc'::text, now()),
    locked_by uuid default auth.uid() references auth.users(id) on delete set null,
    email_status text not null default 'tidak_perlu'
        check (email_status in ('tidak_perlu', 'menunggu', 'terkirim', 'gagal', 'sebagian')),
    email_detail jsonb not null default '[]'::jsonb
);

drop trigger if exists update_nilai_sidang_updated_at on nilai_sidang;
create trigger update_nilai_sidang_updated_at
    before update on nilai_sidang
    for each row execute function update_updated_at_column();

-- Same validation and recompute as nilai_bimbingan (the function only touches columns both share).
drop trigger if exists hitung_nilai_sidang on nilai_sidang;
create trigger hitung_nilai_sidang
    before insert or update on nilai_sidang
    for each row execute function hitung_nilai_bimbingan();

-- Every revisi row needs a catatan; halaman is optional text. Once locked, only Super Admin
-- changes a grade (RLS says so too). A kode rename (only kode_dosen changes) still cascades.
create or replace function cek_nilai_sidang()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if jsonb_typeof(NEW.revisi) is distinct from 'array' then
        raise exception 'Revisi tidak valid.' using errcode = 'check_violation';
    elsif exists (
        select 1 from jsonb_array_elements(NEW.revisi) r
        where not (
            jsonb_typeof(r) = 'object'
            and coalesce(jsonb_typeof(r -> 'catatan') = 'string' and btrim(r ->> 'catatan') <> '', false)
            and coalesce(jsonb_typeof(r -> 'halaman'), 'string') = 'string'
        )
    ) then
        raise exception 'Setiap baris revisi perlu catatan.' using errcode = 'check_violation';
    end if;

    if (TG_OP = 'INSERT' or (NEW.aspek, NEW.ada_revisi, NEW.revisi) is distinct from (OLD.aspek, OLD.ada_revisi, OLD.revisi))
            and not is_superadmin()
            and exists (select 1 from hasil_sidang where defense_id = NEW.defense_id) then
        raise exception 'Nilai sidang sudah dikunci.' using errcode = 'insufficient_privilege';
    end if;
    return NEW;
end;
$$;

drop trigger if exists cek_nilai_sidang on nilai_sidang;
create trigger cek_nilai_sidang
    before insert or update on nilai_sidang
    for each row execute function cek_nilai_sidang();

-- The yudisium must be one of pilihan_yudisium (checked again only when it changes, so a later
-- rules edit never blocks the email update). At lock the DB, not the client, freezes the rules
-- (keys match the TS AturanBeku) and decides whether a revisi email is due: never for an old
-- sidang, otherwise when any examiner has revisi.
create or replace function set_hasil_sidang_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (TG_OP = 'INSERT'
            or (NEW.yudisium_label, NEW.yudisium_lulus) is distinct from (OLD.yudisium_label, OLD.yudisium_lulus))
        and not exists (
            select 1 from aturan_penilaian, jsonb_array_elements(nilai) y
            where prodi = 's1' and kunci = 'pilihan_yudisium'
              and y ->> 'label' = NEW.yudisium_label and y -> 'lulus' = to_jsonb(NEW.yudisium_lulus)
        ) then
        raise exception 'Yudisium tidak ada dalam pilihan yudisium.' using errcode = 'check_violation';
    end if;

    if TG_OP = 'INSERT' then
        NEW.locked_at := now();
        NEW.aturan := jsonb_build_object(
            'tabelNilai', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'tabel_nilai'),
            'predikat', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'predikat'),
            'sksSkripsi', (select nilai from aturan_penilaian where prodi = 's1' and kunci = 'sks_skripsi'));
        NEW.email_status := case
            when exists (select 1 from defenses d
                         where d.id = NEW.defense_id
                           and d.tanggal < (select (nilai #>> '{}')::date from aturan_penilaian
                                            where prodi = 's1' and kunci = 'tanggal_mulai_penilaian'))
                 or not exists (select 1 from nilai_sidang where defense_id = NEW.defense_id and ada_revisi)
            then 'tidak_perlu' else 'menunggu' end;
        NEW.email_detail := '[]'::jsonb;
    end if;
    return NEW;
end;
$$;

drop trigger if exists set_hasil_sidang_locked on hasil_sidang;
create trigger set_hasil_sidang_locked
    before insert or update on hasil_sidang
    for each row execute function set_hasil_sidang_locked();

drop trigger if exists audit_nilai_sidang on nilai_sidang;
create trigger audit_nilai_sidang
    after insert or update or delete on nilai_sidang
    for each row execute function audit_row();

drop trigger if exists audit_hasil_sidang on hasil_sidang;
create trigger audit_hasil_sidang
    after insert or update or delete on hasil_sidang
    for each row execute function audit_row();

-- The caller's peran on an S1 sidang, or null. An EKSTERNAL holds it only on its account's day.
create or replace function my_peran_sidang(p_defense uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case my_kode_penguji()
               when d.penguji_kode then 'ketua'
               when d.penguji_eksternal_kode then 'anggota_1'
               when d.pembimbing_kode then 'anggota_2'
           end
    from defenses d
    where d.id = p_defense
      and d.prodi = 's1' and d.jenis = 'sidang'
      and (not is_eksternal_aktif()
           or exists (select 1 from akun_eksternal a where a.user_id = auth.uid() and a.tanggal = d.tanggal))
$$;

-- The caller holds that peran, the sidang date (Jakarta) has come, it isn't locked,
-- and the Ketua grades only after both anggota.
create or replace function may_grade_sidang(p_defense uuid, p_peran text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(my_peran_sidang(p_defense) = p_peran, false)
        and exists (select 1 from defenses d where d.id = p_defense
                    and (now() at time zone 'Asia/Jakarta')::date >= d.tanggal)
        and not exists (select 1 from hasil_sidang where defense_id = p_defense)
        and (p_peran <> 'ketua'
             or (select count(*) from nilai_sidang where defense_id = p_defense and peran in ('anggota_1', 'anggota_2')) = 2)
$$;

-- Super Admin on an S1 sidang dated before tanggal_mulai_penilaian.
create or replace function may_enter_old_sidang(p_defense uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select is_superadmin() and exists (
        select 1 from defenses d
        where d.id = p_defense
          and d.prodi = 's1' and d.jenis = 'sidang'
          and d.tanggal < (select (nilai #>> '{}')::date from aturan_penilaian
                           where prodi = 's1' and kunci = 'tanggal_mulai_penilaian')
    )
$$;

-- All three grades are in, and the caller is the Ketua (whose own row is one of them)
-- or Super Admin on an old sidang.
create or replace function may_lock_sidang(p_defense uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select (select count(*) from nilai_sidang where defense_id = p_defense) = 3
        and (coalesce(my_peran_sidang(p_defense) = 'ketua', false) or may_enter_old_sidang(p_defense))
$$;

alter table nilai_sidang enable row level security;

-- An examiner reads its own row; the Ketua reads all three (to see the anggota before locking).
drop policy if exists nilai_sidang_select on nilai_sidang;
create policy nilai_sidang_select on nilai_sidang for select to authenticated
    using ((select is_staff()) or my_peran_sidang(defense_id) in ('ketua', peran));
drop policy if exists nilai_sidang_insert on nilai_sidang;
create policy nilai_sidang_insert on nilai_sidang for insert to authenticated with check (
    (sumber = 'dosen' and may_grade_sidang(defense_id, peran)
        and kode_dosen = (select my_kode_penguji()) and submitted_by = auth.uid())
    or (sumber = 'manual' and may_enter_old_sidang(defense_id) and submitted_by = auth.uid())
);
drop policy if exists nilai_sidang_update on nilai_sidang;
create policy nilai_sidang_update on nilai_sidang for update to authenticated
    using (is_superadmin()) with check (is_superadmin());
-- No delete policy: nobody deletes a grade.

alter table hasil_sidang enable row level security;

drop policy if exists hasil_sidang_select on hasil_sidang;
create policy hasil_sidang_select on hasil_sidang for select to authenticated
    using ((select is_staff()) or my_peran_sidang(defense_id) is not null);
drop policy if exists hasil_sidang_insert on hasil_sidang;
create policy hasil_sidang_insert on hasil_sidang for insert to authenticated
    with check (may_lock_sidang(defense_id) and locked_by = auth.uid());
drop policy if exists hasil_sidang_update on hasil_sidang;
create policy hasil_sidang_update on hasil_sidang for update to authenticated
    using (is_superadmin()) with check (is_superadmin());
-- No delete policy: nobody unlocks.

-- Column grants: Supabase's default privileges grant everything, so start from nothing.
revoke all on nilai_sidang, hasil_sidang, akun_eksternal from anon, authenticated;
grant select, insert on nilai_sidang, hasil_sidang to authenticated;
grant update (aspek, nilai, ada_revisi, revisi) on nilai_sidang to authenticated;
grant update (yudisium_label, yudisium_lulus) on hasil_sidang to authenticated;
grant select on akun_eksternal to authenticated;

-- The admin client: reads grades and results, writes the email outcome and the day accounts.
grant select on nilai_sidang, hasil_sidang, akun_eksternal to service_role;
grant update (email_status, email_detail) on hasil_sidang to service_role;
grant insert, update on akun_eksternal to service_role;

-- 4. Defense lock ------------------------------------------------------------------------
-- From 20261109000003, plus sidang: each graded peran keeps its examiner, a graded sidang keeps
-- its date and student. The kode-rename exemption (old kode gone from lecturers) is unchanged.
create or replace function lock_graded_defense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.npm is distinct from OLD.npm or NEW.jenis is distinct from OLD.jenis or NEW.prodi is distinct from OLD.prodi then
        if exists (select 1 from nilai_bimbingan where defense_id = OLD.id) then
            raise exception 'Mahasiswa tidak dapat diubah: prasidang ini sudah dinilai.';
        end if;
        if exists (select 1 from nilai_sidang where defense_id = OLD.id) then
            raise exception 'Mahasiswa tidak dapat diubah: sidang ini sudah dinilai.';
        end if;
    end if;
    if (NEW.pembimbing_kode is distinct from OLD.pembimbing_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_kode)
            and exists (select 1 from nilai_bimbingan where defense_id = OLD.id and peran = 'pembimbing_1'))
        or (NEW.penguji_kode is distinct from OLD.penguji_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_kode)
            and exists (select 1 from nilai_bimbingan where defense_id = OLD.id and peran = 'pembimbing_2')) then
        raise exception 'Dosen pembimbing tidak dapat diubah: prasidang ini sudah dinilai.';
    end if;
    if (NEW.tanggal is distinct from OLD.tanggal
            and exists (select 1 from nilai_sidang where defense_id = OLD.id))
        or (NEW.penguji_kode is distinct from OLD.penguji_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'ketua'))
        or (NEW.penguji_eksternal_kode is distinct from OLD.penguji_eksternal_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_eksternal_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'anggota_1'))
        or (NEW.pembimbing_kode is distinct from OLD.pembimbing_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'anggota_2')) then
        raise exception 'Penguji/tanggal tidak dapat diubah: sidang ini sudah dinilai.';
    end if;
    return NEW;
end;
$$;

drop trigger if exists lock_graded_defense on defenses;
create trigger lock_graded_defense
    before update of pembimbing_kode, penguji_kode, penguji_eksternal_kode, tanggal, npm, jenis, prodi on defenses
    for each row execute function lock_graded_defense();
