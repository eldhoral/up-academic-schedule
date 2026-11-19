-- ==============================================================================
-- Migration: 20261119000004_pembimbing_2_opsional.sql
-- Description: Dosen Pembimbing II becomes optional (kiprat, 2026-11-19). An S1 student
-- without one carries the explicit flag tanpa_pembimbing_2, so a forgotten field is never
-- read as "has none". The sidang gate takes Pembimbing I plus (Pembimbing II or the flag);
-- Nilai Bimbingan of a flagged student is Pembimbing I's grade (computed in the app).
-- ==============================================================================

alter table students add column if not exists tanpa_pembimbing_2 boolean not null default false;

-- The flag and a Pembimbing II exclude each other. With cek_pembimbing_mahasiswa (a graded slot
-- keeps its dosen), the flag can't be set once Pembimbing II has graded.
alter table students drop constraint if exists chk_students_tanpa_pembimbing_2;
alter table students add constraint chk_students_tanpa_pembimbing_2
    check (not (tanpa_pembimbing_2 and pembimbing_2_kode is not null));

create or replace function pembimbing_lengkap(p_npm varchar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from students where npm = p_npm and prodi = 's1'
                   and pembimbing_1_kode is not null and (pembimbing_2_kode is not null or tanpa_pembimbing_2))
$$;

-- From 20261119000002, with the new Pembimbing message. Security invoker (see 20261119000001).
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
        raise exception 'Dosen Pembimbing mahasiswa belum lengkap di Data Mahasiswa.' using errcode = 'check_violation';
    end if;
    return NEW;
end;
$$;
