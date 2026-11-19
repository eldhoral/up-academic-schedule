-- ==============================================================================
-- Migration: 20261119000003_nilai_sidang_live.sql
-- Description: Sidang examiners grade together (kiprat, 2026-11-19). Every examiner of
-- an S1 sidang reads all three sent grades; the Ketua sends its grade like an anggota,
-- in any order, and locks separately once all three exist (a plain hasil_sidang insert),
-- so the grade-and-lock RPCs go. Grades and the lock are published to Supabase Realtime
-- so open grading pages refresh. Ketentuan Umum becomes a rule.
-- ==============================================================================

-- 1. Read rule: any examiner of that sidang (my_peran_sidang already binds an EKSTERNAL to its day).
drop policy if exists nilai_sidang_select on nilai_sidang;
create policy nilai_sidang_select on nilai_sidang for select to authenticated
    using ((select is_staff()) or my_peran_sidang(defense_id) is not null);

-- 2. Any order: the caller holds that peran, the sidang date (Jakarta) has come, and it isn't locked.
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
$$;

-- 3. The lock is its own step now (may_lock_sidang: all three rows, Ketua or Super Admin).
drop function if exists kunci_sidang(uuid, jsonb, boolean, jsonb, text, boolean);
drop function if exists kunci_sidang_admin(uuid, jsonb, boolean, jsonb, text, boolean);

-- 4. Ketentuan Umum, from the KETUA PENGUJI sheet; the Nilai and predikat tables are rendered from their own rules.
alter table aturan_penilaian drop constraint if exists chk_aturan_penilaian_kunci;
alter table aturan_penilaian add constraint chk_aturan_penilaian_kunci
    check (kunci in ('aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian',
                     'aspek_sidang', 'pilihan_yudisium', 'pertanyaan_prasidang', 'batas_hari_bimbingan', 'ketentuan_sidang'));

insert into aturan_penilaian (prodi, kunci, nilai) values
    ('s1', 'ketentuan_sidang', '[
        "Naskah skripsi berisi kurang lebih 60 sampai dengan 80 halaman (tidak termasuk lampiran dan Daftar Pustaka)",
        "Format mengikuti tradisi ilmiah yang berlaku di dunia internasional dan merujuk pada APA",
        "Abstrak dalam bentuk narasi dalam bahasa Indonesia dan bahasa Inggris",
        "Nilai yang diberikan dalam bentuk angka dari 1 sampai dengan 100",
        "Predikat \"Dengan Pujian\" hanya diberikan apabila mahasiswa menyelesaikan seluruh mata kuliah tepat waktu"
    ]'::jsonb)
on conflict (prodi, kunci) do nothing;

-- 5. Realtime: only where Supabase's publication exists (plain Postgres in check:db has none).
-- RLS still decides which subscriber gets which change.
do $$
declare t text;
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        foreach t in array array['nilai_sidang', 'hasil_sidang'] loop
            if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
                execute format('alter publication supabase_realtime add table public.%I', t);
            end if;
        end loop;
    end if;
end $$;
