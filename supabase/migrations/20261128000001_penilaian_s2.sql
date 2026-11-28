-- ==============================================================================
-- Migration: 20261128000001_penilaian_s2.sql
-- Description: Online grading for S2 too (kiprat 2026-11-27): the seminar proposal berita acara, the
-- sidang tesis grade and lock, Nilai Bimbingan and Nilai Akhir, with S2's own rules. S2 starts with a
-- copy of S1's rules and email templates; each prodi then edits its own. Every function that was bound
-- to prodi 's1' now takes the defense's prodi and reads that prodi's rules. NPM is unique across the
-- university and a student belongs to one prodi, so student joins match on the defense's prodi.
-- ==============================================================================

-- S2's rules: a copy of S1's as they stand (aspek, Tabel Nilai, predikat, SKS, yudisium, questions, ...).
insert into aturan_penilaian (prodi, kunci, nilai)
select 's2', kunci, nilai from aturan_penilaian where prodi = 's1'
on conflict (prodi, kunci) do nothing;

-- S2's email templates, worded for the tesis and the seminar proposal.
insert into settings (key, value, type, "group", label, help, urutan, prodi)
select key,
       replace(replace(replace(value, 'Sidang Skripsi', 'Sidang Tesis'), 'Prasidang', 'Seminar Proposal'), 'prasidang', 'seminar proposal'),
       type, "group",
       replace(replace(replace(label, 'Sidang Skripsi', 'Sidang Tesis'), 'Prasidang', 'Seminar Proposal'), 'prasidang', 'seminar proposal'),
       replace(replace(help, 'prasidang', 'seminar proposal'), 'sidang dikunci', 'sidang tesis dikunci'),
       urutan, 's2'
from settings
where prodi = 's1' and key in ('email_revisi_subjek', 'email_revisi_isi', 'email_revisi_cc_kaprodi', 'email_revisi_cc_wadek1',
                               'email_prasidang_subjek', 'email_prasidang_isi')
on conflict (key, prodi) do nothing;

-- The lock freezes the defense's own prodi's rules and checks its yudisium choices.
create or replace function set_hasil_sidang_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_prodi varchar;
begin
    select prodi into v_prodi from defenses where id = NEW.defense_id;
    if (TG_OP = 'INSERT'
            or (NEW.yudisium_label, NEW.yudisium_lulus) is distinct from (OLD.yudisium_label, OLD.yudisium_lulus))
        and not exists (
            select 1 from aturan_penilaian, jsonb_array_elements(nilai) y
            where prodi = v_prodi and kunci = 'pilihan_yudisium'
              and y ->> 'label' = NEW.yudisium_label and y -> 'lulus' = to_jsonb(NEW.yudisium_lulus)
        ) then
        raise exception 'Yudisium tidak ada dalam pilihan yudisium.' using errcode = 'check_violation';
    end if;

    if TG_OP = 'INSERT' then
        NEW.locked_at := now();
        NEW.aturan := jsonb_build_object(
            'tabelNilai', (select nilai from aturan_penilaian where prodi = v_prodi and kunci = 'tabel_nilai'),
            'predikat', (select nilai from aturan_penilaian where prodi = v_prodi and kunci = 'predikat'),
            'sksSkripsi', (select nilai from aturan_penilaian where prodi = v_prodi and kunci = 'sks_skripsi'));
        NEW.email_status := case
            when exists (select 1 from defenses d
                         where d.id = NEW.defense_id
                           and d.tanggal < (select (nilai #>> '{}')::date from aturan_penilaian
                                            where prodi = v_prodi and kunci = 'tanggal_mulai_penilaian'))
                 or not exists (select 1 from nilai_sidang where defense_id = NEW.defense_id and ada_revisi)
            then 'tidak_perlu' else 'menunggu' end;
        NEW.email_detail := '[]'::jsonb;
    end if;
    return NEW;
end;
$$;

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
      and d.prodi in ('s1', 's2') and d.jenis = 'sidang'
      and (not is_eksternal_aktif()
           or exists (select 1 from akun_eksternal a where a.user_id = auth.uid() and a.tanggal = d.tanggal))
$$;

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
          and d.prodi in ('s1', 's2') and d.jenis = 'sidang'
          and d.tanggal < (select (nilai #>> '{}')::date from aturan_penilaian
                           where prodi = d.prodi and kunci = 'tanggal_mulai_penilaian')
    )
$$;

create or replace function cek_berita_acara()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if jsonb_typeof(NEW.jawaban) is distinct from 'array' or jsonb_array_length(NEW.jawaban) = 0
        or exists (
            select 1 from jsonb_array_elements(NEW.jawaban) j
            where not (
                jsonb_typeof(j) = 'object'
                and coalesce(jsonb_typeof(j -> 'teks') = 'string' and btrim(j ->> 'teks') <> '', false)
                and coalesce(jsonb_typeof(j -> 'catatan') = 'string', false)
                and case j ->> 'jenis'
                    when 'ya_tidak' then coalesce(jsonb_typeof(j -> 'ya') = 'boolean' and length(j ->> 'catatan') <= 1000, false)
                    when 'uraian' then coalesce(jsonb_typeof(j -> 'ya') = 'null' and btrim(j ->> 'catatan') <> ''
                                                and length(j ->> 'catatan') <= 2000, false)
                    else false
                end
            )
        ) then
        raise exception 'Berita acara tidak valid.' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from defenses where id = NEW.defense_id and prodi in ('s1', 's2') and jenis = 'prasidang') then
        raise exception 'Berita acara hanya untuk prasidang atau seminar proposal.' using errcode = 'check_violation';
    end if;
    if TG_OP = 'INSERT' then
        NEW.submitted_at := timezone('utc'::text, now());
        NEW.created_at := NEW.submitted_at;
        NEW.email_status := 'menunggu';
        NEW.email_detail := '[]'::jsonb;
    end if;
    return NEW;
end;
$$;

create or replace function may_isi_berita_acara(p_defense uuid, p_peran text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select p_peran = 'pendamping' and exists (
        select 1 from defenses d
        where d.id = p_defense
          and d.prodi in ('s1', 's2') and d.jenis = 'prasidang'
          and my_kode_dosen() = d.pembimbing_kode
          and (now() at time zone 'Asia/Jakarta')::date >= d.tanggal
    )
$$;

create or replace function status_prasidang(p_npm varchar)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    pras uuid;
    k text;
    a text;
begin
    if current_setting('role', true) in ('authenticated', 'anon') and not is_staff() then return null; end if;
    select id into pras from defenses
    where npm = p_npm and prodi in ('s1', 's2') and jenis = 'prasidang'
    order by tanggal desc, created_at desc
    limit 1;

    select hasil into k from keputusan_prasidang where npm = p_npm and prasidang_id is not distinct from pras;
    if k is not null then return k; end if;
    if pras is null then return 'tidak_ada'; end if;

    select hasil into a from berita_acara_prasidang where defense_id = pras and peran = 'pendamping';
    return coalesce(a, 'belum_lengkap');
end;
$$;

-- The sidang gate for both prodi: S2's sidang tesis needs its seminar proposal result, as S1's sidang needs its prasidang.
create or replace function gerbang_sidang()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    s text;
    pras text := case when NEW.prodi = 's2' then 'seminar proposal' else 'prasidang' end;
begin
    if current_user not in ('authenticated', 'anon') then return NEW; end if;
    if NEW.prodi not in ('s1', 's2') or NEW.jenis <> 'sidang' then return NEW; end if;
    if TG_OP = 'UPDATE' and (NEW.npm, NEW.jenis, NEW.prodi) is not distinct from (OLD.npm, OLD.jenis, OLD.prodi) then
        return NEW;
    end if;
    s := status_prasidang(NEW.npm);
    if s = 'tidak_ada' then
        raise exception 'Mahasiswa belum memiliki %. Super Admin dapat memberi keputusan di Data Mahasiswa.', pras using errcode = 'check_violation';
    elsif s = 'belum_lengkap' then
        raise exception 'Berita acara % belum lengkap.', pras using errcode = 'check_violation';
    elsif s = 'tidak_layak' then
        raise exception 'Hasil %: % tidak layak untuk dilanjutkan.', pras, case when NEW.prodi = 's2' then 'tesis' else 'skripsi' end
            using errcode = 'check_violation';
    end if;
    if not pembimbing_lengkap(NEW.npm) then
        raise exception 'Dosen Pembimbing mahasiswa belum lengkap di Data Mahasiswa.' using errcode = 'check_violation';
    end if;
    return NEW;
end;
$$;

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
                        where d.npm = OLD.npm and d.prodi = OLD.prodi and nb.peran = 'pembimbing_1'))
        or (NEW.pembimbing_2_kode is distinct from OLD.pembimbing_2_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_2_kode)
            and exists (select 1 from nilai_bimbingan nb join defenses d on d.id = nb.defense_id
                        where d.npm = OLD.npm and d.prodi = OLD.prodi and nb.peran = 'pembimbing_2'))) then
        raise exception 'Dosen pembimbing tidak dapat diubah: nilai bimbingan sudah dikirim.';
    end if;
    return NEW;
end;
$$;

create or replace function pembimbing_lengkap(p_npm varchar)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from students where npm = p_npm and prodi in ('s1', 's2')
                   and pembimbing_1_kode is not null and (pembimbing_2_kode is not null or tanpa_pembimbing_2))
$$;

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
    if not exists (select 1 from defenses where id = NEW.defense_id and prodi in ('s1', 's2') and jenis = 'sidang') then
        raise exception 'Nilai bimbingan hanya untuk sidang skripsi atau tesis.' using errcode = 'check_violation';
    end if;
    select case NEW.peran when 'pembimbing_1' then s.pembimbing_1_kode else s.pembimbing_2_kode end into kode
    from defenses d join students s on s.npm = d.npm and s.prodi = d.prodi
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
        join students s on s.npm = d.npm and s.prodi = d.prodi
        join hasil_sidang h on h.defense_id = d.id
        where d.id = p_defense
          and d.prodi in ('s1', 's2') and d.jenis = 'sidang'
          and h.yudisium_lulus
          and my_kode_dosen() = case p_peran when 'pembimbing_1' then s.pembimbing_1_kode
                                             when 'pembimbing_2' then s.pembimbing_2_kode end
          and (now() at time zone 'Asia/Jakarta')::date
              <= (h.locked_at at time zone 'Asia/Jakarta')::date
                 + coalesce((select (nilai #>> '{}')::int from aturan_penilaian
                             where prodi = d.prodi and kunci = 'batas_hari_bimbingan'), 7)
    )
$$;

create or replace function hapus_prasidang_paksa(p_id uuid, p_npm varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_npm varchar;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat menghapus prasidang yang sudah diisi berita acaranya.'
            using errcode = 'insufficient_privilege';
    end if;
    select npm into v_npm from defenses where id = p_id and prodi in ('s1', 's2') and jenis = 'prasidang' for update;
    if not found then
        raise exception 'Prasidang tidak ditemukan.';
    end if;
    if btrim(coalesce(p_npm, '')) <> v_npm then
        raise exception 'NPM tidak cocok.';
    end if;
    delete from berita_acara_prasidang where defense_id = p_id;
    delete from defenses where id = p_id;
end;
$$;

create or replace function hapus_sidang_paksa(p_id uuid, p_npm varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_npm varchar;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat menghapus sidang yang sudah dinilai.'
            using errcode = 'insufficient_privilege';
    end if;
    select npm into v_npm from defenses where id = p_id and prodi in ('s1', 's2') and jenis = 'sidang' for update;
    if not found then
        raise exception 'Sidang tidak ditemukan.';
    end if;
    if btrim(coalesce(p_npm, '')) <> v_npm then
        raise exception 'NPM tidak cocok.';
    end if;
    delete from nilai_bimbingan where defense_id = p_id;
    delete from hasil_sidang where defense_id = p_id;
    delete from nilai_sidang where defense_id = p_id;
    delete from defenses where id = p_id;
end;
$$;
