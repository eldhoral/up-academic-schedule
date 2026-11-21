-- ==============================================================================
-- Migration: 20261121000001_prasidang_ruang.sql
-- Description: Prasidang is scheduled in a room (room_id), like sidang, instead of a
-- numbered Zoom breakout kelompok. kelompok stays for rows saved before this:
-- a prasidang has a room OR a kelompok, and picks a room the next time it is saved.
-- The default print title says RUANG {ruang} instead of KELOMPOK {kelompok}.
-- ==============================================================================

alter table defenses drop constraint if exists chk_defenses_place;
alter table defenses add constraint chk_defenses_place check (
    (jenis = 'sidang' and kelompok is null)
    or (jenis = 'prasidang' and (room_id is null) <> (kelompok is null) and penguji_eksternal = '')
);

-- Only titles still on the shipped default; an edited title is the admin's own.
update settings set value = replace(value, E'\nKELOMPOK {kelompok}', E'\nRUANG {ruang}')
where key = 'prasidang_header_baris' and value like E'%\nKELOMPOK {kelompok}';
