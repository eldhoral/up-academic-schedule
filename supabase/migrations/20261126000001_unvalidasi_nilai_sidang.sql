-- ==============================================================================
-- Migration: 20261126000001_unvalidasi_nilai_sidang.sql
-- Description: The Ketua Sidang may send an Anggota Penguji I or II grade back before locking
-- (kiprat, 2026-11-25): the row is deleted, so that examiner grades again. nilai_sidang has no
-- delete policy, so this is the only path; audit_nilai_sidang keeps the deleted row in the log.
-- ==============================================================================

create or replace function unvalidasi_nilai_sidang(p_defense uuid, p_peran text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_peran not in ('anggota_1', 'anggota_2') then
        raise exception 'Sidang tidak ditemukan.' using errcode = 'check_violation';
    end if;
    if not coalesce(my_peran_sidang(p_defense) = 'ketua', false) then
        raise exception 'Hanya Ketua Sidang yang dapat membatalkan validasi nilai.' using errcode = 'insufficient_privilege';
    end if;
    -- A hasil_sidang insert key-share locks this row (its foreign key): a lock in flight finishes first, then is seen below.
    perform 1 from defenses where id = p_defense for update;
    if exists (select 1 from hasil_sidang where defense_id = p_defense) then
        raise exception 'Nilai sidang sudah dikunci.' using errcode = 'insufficient_privilege';
    end if;
    delete from nilai_sidang where defense_id = p_defense and peran = p_peran;
    if not found then
        raise exception 'Nilai belum dikirim.' using errcode = 'no_data_found';
    end if;
end;
$$;

revoke execute on function unvalidasi_nilai_sidang(uuid, text) from public, anon;
grant execute on function unvalidasi_nilai_sidang(uuid, text) to authenticated;
