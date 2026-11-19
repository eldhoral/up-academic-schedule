-- ==============================================================================
-- Migration: 20261119000002_bimbingan_pasca_sidang.sql
-- Description: Nilai Bimbingan moves from the prasidang to the sidang. It is given
-- by the student's own Dosen Pembimbing I and II (now on students), after the
-- Ketua locks the sidang with a lulus yudisium, for batas_hari_bimbingan days
-- (lock day = day 0). Super Admin enters or edits any bimbingan or sidang grade
-- at any time and can lock on the Ketua's behalf (kunci_sidang_admin). The sidang
-- gate also needs both Pembimbing. (Prasidang grades were test data and are gone.)
-- ==============================================================================

-- 1. Dosen Pembimbing on the student -------------------------------------------------------
alter table students
    add column if not exists pembimbing_1_kode varchar(30) null references lecturers(kode_dosen) on update cascade on delete restrict,
    add column if not exists pembimbing_2_kode varchar(30) null references lecturers(kode_dosen) on update cascade on delete restrict;
alter table students drop constraint if exists chk_students_pembimbing_beda;
alter table students add constraint chk_students_pembimbing_beda
    check (pembimbing_1_kode is null or pembimbing_2_kode is null or pembimbing_1_kode <> pembimbing_2_kode);

-- Internal dosen only, and a slot with a submitted grade keeps its dosen. A kode rename
-- (on update cascade: the old kode is gone from lecturers by then) is not a reassignment.
create or replace function cek_pembimbing_mahasiswa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if exists (select 1 from lecturers where eksternal
               and kode_dosen in (NEW.pembimbing_1_kode, NEW.pembimbing_2_kode)
               and kode_dosen is distinct from case when TG_OP = 'UPDATE' then OLD.pembimbing_1_kode end
               and kode_dosen is distinct from case when TG_OP = 'UPDATE' then OLD.pembimbing_2_kode end) then
        raise exception 'Dosen eksternal tidak dapat menjadi Dosen Pembimbing.';
    end if;
    if TG_OP = 'UPDATE' and (
        (NEW.pembimbing_1_kode is distinct from OLD.pembimbing_1_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_1_kode)
            and exists (select 1 from nilai_bimbingan nb join defenses d on d.id = nb.defense_id
                        where d.npm = OLD.npm and d.prodi = 's1' and nb.peran = 'pembimbing_1'))
        or (NEW.pembimbing_2_kode is distinct from OLD.pembimbing_2_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_2_kode)
            and exists (select 1 from nilai_bimbingan nb join defenses d on d.id = nb.defense_id
                        where d.npm = OLD.npm and d.prodi = 's1' and nb.peran = 'pembimbing_2'))) then
        raise exception 'Dosen pembimbing tidak dapat diubah: nilai bimbingan sudah dikirim.';
    end if;
    return NEW;
end;
$$;

drop trigger if exists cek_pembimbing_mahasiswa on students;
create trigger cek_pembimbing_mahasiswa
    before insert or update of pembimbing_1_kode, pembimbing_2_kode on students
    for each row execute function cek_pembimbing_mahasiswa();

-- 2. Gate: the verdict, then both Pembimbing ----------------------------------------------
create or replace function pembimbing_lengkap(p_npm varchar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from students where npm = p_npm and prodi = 's1'
                   and pembimbing_1_kode is not null and pembimbing_2_kode is not null)
$$;
revoke execute on function pembimbing_lengkap(varchar) from public, anon;
grant execute on function pembimbing_lengkap(varchar) to authenticated, service_role;

-- From 20261119000001, plus the Pembimbing check. Security invoker (see there).
create or replace function gerbang_sidang()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    s text;
begin
    if current_user not in ('authenticated', 'anon') then return NEW; end if;
    if NEW.prodi <> 's1' or NEW.jenis <> 'sidang' then return NEW; end if;
    if TG_OP = 'UPDATE' and (NEW.npm, NEW.jenis, NEW.prodi) is not distinct from (OLD.npm, OLD.jenis, OLD.prodi) then
        return NEW;
    end if;
    s := status_prasidang(NEW.npm);
    if s = 'tidak_ada' then
        raise exception 'Mahasiswa belum memiliki prasidang. Super Admin dapat memberi keputusan di Data Mahasiswa.' using errcode = 'check_violation';
    elsif s = 'belum_lengkap' then
        raise exception 'Berita acara prasidang belum lengkap.' using errcode = 'check_violation';
    elsif s = 'tidak_layak' then
        raise exception 'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.' using errcode = 'check_violation';
    end if;
    if not pembimbing_lengkap(NEW.npm) then
        raise exception 'Dosen Pembimbing I dan II mahasiswa belum diisi di Data Mahasiswa.' using errcode = 'check_violation';
    end if;
    return NEW;
end;
$$;

-- 3. Nilai Bimbingan on the sidang -------------------------------------------------------------
-- Target and dosen, for every row (manual too): an S1 sidang, and kode_dosen is the student's
-- Pembimbing for that peran. A kode rename (only kode_dosen changes, cascaded) passes: the
-- student's column is renamed by the same cascade.
create or replace function cek_nilai_bimbingan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    kode varchar;
begin
    if TG_OP = 'UPDATE' and (NEW.defense_id, NEW.peran) is not distinct from (OLD.defense_id, OLD.peran)
            and not exists (select 1 from lecturers where kode_dosen = OLD.kode_dosen) then
        return NEW;
    end if;
    if not exists (select 1 from defenses where id = NEW.defense_id and prodi = 's1' and jenis = 'sidang') then
        raise exception 'Nilai bimbingan hanya untuk sidang S1.' using errcode = 'check_violation';
    end if;
    select case NEW.peran when 'pembimbing_1' then s.pembimbing_1_kode else s.pembimbing_2_kode end into kode
    from defenses d join students s on s.npm = d.npm and s.prodi = 's1'
    where d.id = NEW.defense_id;
    if kode is null then
        raise exception 'Dosen Pembimbing untuk peran ini belum diisi di Data Mahasiswa.' using errcode = 'check_violation';
    end if;
    if kode <> NEW.kode_dosen then
        raise exception 'Dosen tidak sesuai dengan Dosen Pembimbing mahasiswa.' using errcode = 'check_violation';
    end if;
    return NEW;
end;
$$;

drop trigger if exists cek_nilai_bimbingan on nilai_bimbingan;
create trigger cek_nilai_bimbingan
    before insert or update of defense_id, kode_dosen, peran on nilai_bimbingan
    for each row execute function cek_nilai_bimbingan();

-- The caller is the student's Pembimbing for that peran; the sidang is locked lulus; today (Jakarta)
-- is within lock date + batas_hari_bimbingan (default 7).
create or replace function may_grade_bimbingan(p_defense uuid, p_peran text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from defenses d
        join students s on s.npm = d.npm and s.prodi = 's1'
        join hasil_sidang h on h.defense_id = d.id
        where d.id = p_defense
          and d.prodi = 's1' and d.jenis = 'sidang'
          and h.yudisium_lulus
          and my_kode_dosen() = case p_peran when 'pembimbing_1' then s.pembimbing_1_kode
                                             when 'pembimbing_2' then s.pembimbing_2_kode end
          and (now() at time zone 'Asia/Jakarta')::date
              <= (h.locked_at at time zone 'Asia/Jakarta')::date
                 + coalesce((select (nilai #>> '{}')::int from aturan_penilaian
                             where prodi = 's1' and kunci = 'batas_hari_bimbingan'), 7)
    )
$$;

-- 4. Super Admin, any time ------------------------------------------------------------------------
drop policy if exists nilai_bimbingan_insert on nilai_bimbingan;
create policy nilai_bimbingan_insert on nilai_bimbingan for insert to authenticated with check (
    (sumber = 'dosen' and may_grade_bimbingan(defense_id, peran)
        and kode_dosen = (select my_kode_dosen()) and submitted_by = auth.uid())
    or (sumber = 'manual' and is_superadmin() and submitted_by = auth.uid())
);

drop policy if exists nilai_sidang_insert on nilai_sidang;
create policy nilai_sidang_insert on nilai_sidang for insert to authenticated with check (
    (sumber = 'dosen' and may_grade_sidang(defense_id, peran)
        and kode_dosen = (select my_kode_penguji()) and submitted_by = auth.uid())
    or (sumber = 'manual' and is_superadmin() and submitted_by = auth.uid())
);

-- All three grades are in, and the caller is the Ketua or Super Admin.
create or replace function may_lock_sidang(p_defense uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select (select count(*) from nilai_sidang where defense_id = p_defense) = 3
        and (coalesce(my_peran_sidang(p_defense) = 'ketua', false) or is_superadmin())
$$;

drop function if exists may_enter_old_bimbingan(uuid);
drop function if exists may_enter_old_sidang(uuid);

-- Super Admin's Ketua grade and the lock in one call, like kunci_sidang: a failed lock never
-- leaves a Ketua grade behind. The Ketua row is the defense's penguji_kode, sumber 'manual'.
create or replace function kunci_sidang_admin(
    p_defense uuid, p_aspek jsonb, p_ada_revisi boolean, p_revisi jsonb, p_yudisium_label text, p_yudisium_lulus boolean
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
    status text;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat mengunci atas nama Ketua.' using errcode = 'insufficient_privilege';
    end if;
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, sumber, submitted_by)
    values (p_defense, (select penguji_kode from defenses where id = p_defense), 'ketua', p_aspek, 0, p_ada_revisi, p_revisi, 'manual', auth.uid());
    insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, locked_by)
    values (p_defense, p_yudisium_label, p_yudisium_lulus, auth.uid())
    returning email_status into status;
    return status;
end;
$$;

revoke execute on function kunci_sidang_admin(uuid, jsonb, boolean, jsonb, text, boolean) from public, anon;
grant execute on function kunci_sidang_admin(uuid, jsonb, boolean, jsonb, text, boolean) to authenticated;
