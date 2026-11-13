-- ==============================================================================
-- Migration: 20261116000003_kunci_sidang.sql
-- Description: The Ketua's grade and the lock in one call, so a failed lock never
-- leaves a Ketua grade behind (which would block the sidang for good: the Ketua
-- grades once, and only the Ketua locks a new sidang). Security invoker: RLS,
-- the grade triggers and the hasil_sidang trigger all apply as for the two inserts.
-- nilai is recomputed by the trigger; aturan and email_status are set by the DB.
-- Returns the new email_status ('menunggu' or 'tidak_perlu').
-- ==============================================================================
create or replace function kunci_sidang(
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
    insert into nilai_sidang (defense_id, kode_dosen, peran, aspek, nilai, ada_revisi, revisi, sumber, submitted_by)
    values (p_defense, my_kode_penguji(), 'ketua', p_aspek, 0, p_ada_revisi, p_revisi, 'dosen', auth.uid());
    insert into hasil_sidang (defense_id, yudisium_label, yudisium_lulus, locked_by)
    values (p_defense, p_yudisium_label, p_yudisium_lulus, auth.uid())
    returning email_status into status;
    return status;
end;
$$;

revoke execute on function kunci_sidang(uuid, jsonb, boolean, jsonb, text, boolean) from public, anon;
grant execute on function kunci_sidang(uuid, jsonb, boolean, jsonb, text, boolean) to authenticated;
