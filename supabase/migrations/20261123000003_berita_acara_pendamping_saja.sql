-- ==============================================================================
-- Migration: 20261123000003_berita_acara_pendamping_saja.sql
-- Description: Berita Acara Prasidang (S1) is filled by the Dosen Pembimbing
-- Pendamping (pembimbing_kode) only; the Dosen Pembahas (penguji_kode) attends
-- but no longer fills it (faculty feedback, 2026-11-23). The prasidang verdict is
-- the Pendamping's alone. Pembahas rows already submitted stay in the table for
-- the record but no longer count. Same rule as statusPrasidang() in TS.
-- ==============================================================================

-- Only the Pendamping may insert.
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
          and d.prodi = 's1' and d.jenis = 'prasidang'
          and my_kode_dosen() = d.pembimbing_kode
          and (now() at time zone 'Asia/Jakarta')::date >= d.tanggal
    )
$$;

-- layak | layak_revisi | tidak_layak | belum_lengkap | tidak_ada, from the Pendamping's berita acara.
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
    where npm = p_npm and prodi = 's1' and jenis = 'prasidang'
    order by tanggal desc, created_at desc
    limit 1;

    select hasil into k from keputusan_prasidang where npm = p_npm and prasidang_id is not distinct from pras;
    if k is not null then return k; end if;
    if pras is null then return 'tidak_ada'; end if;

    select hasil into a from berita_acara_prasidang where defense_id = pras and peran = 'pendamping';
    return coalesce(a, 'belum_lengkap');
end;
$$;
revoke execute on function status_prasidang(varchar) from public, anon;
grant execute on function status_prasidang(varchar) to authenticated, service_role;
