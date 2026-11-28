-- ==============================================================================
-- Migration: 20261128000003_periode_bimbingan.sql
-- Description: Pengisian nilai bimbingan runs from one date to another (kiprat 2026-11-27), set per
-- prodi in Pengaturan Penilaian, instead of the lock day plus n days. A Dosen Pembimbing grades once the
-- sidang is locked lulus and today (Jakarta) is within the range, both ends inclusive. Each prodi starts
-- with today to today + 30 days; Super Admin sets the real dates. batas_hari_bimbingan stays, unused.
-- ==============================================================================

alter table aturan_penilaian drop constraint if exists chk_aturan_penilaian_kunci;
alter table aturan_penilaian add constraint chk_aturan_penilaian_kunci
    check (kunci in ('aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian',
                     'aspek_sidang', 'pilihan_yudisium', 'pertanyaan_prasidang', 'batas_hari_bimbingan', 'ketentuan_sidang',
                     'periode_bimbingan'));

insert into aturan_penilaian (prodi, kunci, nilai)
select p, 'periode_bimbingan', jsonb_build_object(
    'mulai', to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD'),
    'selesai', to_char((now() at time zone 'Asia/Jakarta')::date + 30, 'YYYY-MM-DD'))
from unnest(array['s1', 's2']) p
on conflict (prodi, kunci) do nothing;

-- The window is the prodi's range (a missing or broken row opens today to today + 30, as the app does).
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
        left join lateral (
            select case when jsonb_typeof(nilai -> 'mulai') = 'string' and jsonb_typeof(nilai -> 'selesai') = 'string'
                        then nilai end as p
            from aturan_penilaian where prodi = d.prodi and kunci = 'periode_bimbingan'
        ) r on true
        where d.id = p_defense
          and d.prodi in ('s1', 's2') and d.jenis = 'sidang'
          and h.yudisium_lulus
          and my_kode_dosen() = case p_peran when 'pembimbing_1' then s.pembimbing_1_kode
                                             when 'pembimbing_2' then s.pembimbing_2_kode end
          and (now() at time zone 'Asia/Jakarta')::date
              between coalesce((r.p ->> 'mulai')::date, (now() at time zone 'Asia/Jakarta')::date)
                  and coalesce((r.p ->> 'selesai')::date, (now() at time zone 'Asia/Jakarta')::date + 30)
    )
$$;
