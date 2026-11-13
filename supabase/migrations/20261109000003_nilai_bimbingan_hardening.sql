-- ==============================================================================
-- Migration: 20261109000003_nilai_bimbingan_hardening.sql
-- Description: Nilai Bimbingan hardening. The admin client may read the grade
-- tables; the DB computes nilai from aspek and owns the timestamps; Super Admin
-- edits only aspek/nilai; a graded prasidang keeps its student; grading rules are
-- never deleted; nobody signed in may run the audit_log purge.
-- ==============================================================================

-- 1. Admin client reads (loadPenilaian, Penilaian Saya). Same as 20261008000003_jadwal_dosen.sql.
grant select on students, nilai_bimbingan, aturan_penilaian to service_role;

-- 2. nilai is computed from the aspek snapshot; the client's nilai and timestamps are ignored.
-- Mirrors validateAspek/snapshotDariSkor (src/lib/penilaian): numeric round is half away from
-- zero, which is round2 for these non-negative scores.
create or replace function hitung_nilai_bimbingan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    total numeric;
begin
    if jsonb_typeof(NEW.aspek) is distinct from 'array' or jsonb_array_length(NEW.aspek) = 0 or exists (
        select 1 from jsonb_array_elements(NEW.aspek) a
        where not (
            jsonb_typeof(a) = 'object'
            and coalesce(jsonb_typeof(a -> 'label') = 'string' and btrim(a ->> 'label') <> '', false)
            and case when jsonb_typeof(a -> 'bobot') = 'number' then (a ->> 'bobot')::numeric > 0 else false end
            and case when jsonb_typeof(a -> 'skor') = 'number' then (a ->> 'skor')::numeric between 0 and 100 else false end
        )
    ) then
        raise exception 'Aspek penilaian tidak valid: setiap aspek perlu nama, bobot lebih dari 0 dan skor 0–100.'
            using errcode = 'check_violation';
    end if;

    select round(sum((a ->> 'bobot')::numeric), 2),
           round(sum((a ->> 'skor')::numeric * (a ->> 'bobot')::numeric) / 100, 2)
    into total, NEW.nilai
    from jsonb_array_elements(NEW.aspek) a;
    if total <> 100 then
        raise exception 'Total bobot aspek harus 100 (sekarang %).', total using errcode = 'check_violation';
    end if;

    if TG_OP = 'INSERT' then
        NEW.submitted_at := now();
        NEW.created_at := now();
        NEW.updated_at := now();
    end if;
    return NEW;
end;
$$;

drop trigger if exists hitung_nilai_bimbingan on nilai_bimbingan;
create trigger hitung_nilai_bimbingan
    before insert or update on nilai_bimbingan
    for each row execute function hitung_nilai_bimbingan();

-- 3. Super Admin edits only the scores. nilai stays granted (editNilaiAction sends it); the trigger
-- recomputes it. A lecturer kode rename still cascades: FK actions run as the table owner.
revoke update on nilai_bimbingan from authenticated;
grant update (aspek, nilai) on nilai_bimbingan to authenticated;

-- 4. A graded prasidang keeps its student, jenis and prodi, and each graded peran its dosen.
-- Same function as 20261109000002, plus the student check; the kode-rename exemption is unchanged.
create or replace function lock_graded_defense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (NEW.npm is distinct from OLD.npm or NEW.jenis is distinct from OLD.jenis or NEW.prodi is distinct from OLD.prodi)
            and exists (select 1 from nilai_bimbingan where defense_id = OLD.id) then
        raise exception 'Mahasiswa tidak dapat diubah: prasidang ini sudah dinilai.';
    end if;
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
    before update of pembimbing_kode, penguji_kode, npm, jenis, prodi on defenses
    for each row execute function lock_graded_defense();

-- 5. No UI deletes a rule, and a missing tanggal_mulai_penilaian row would split the app's
-- default from the DB's (may_enter_old_bimbingan reads null).
drop policy if exists aturan_penilaian_delete on aturan_penilaian;

-- 6. Only the cron job (postgres, the owner) purges the audit log.
revoke execute on function purge_old_audit_log() from public, anon, authenticated;
