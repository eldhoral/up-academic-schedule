-- ==============================================================================
-- Migration: 20261017000001_keterangan_ujian_kosong.sql
-- Description: Keterangan ujian may be empty, and a new UTS/UAS row starts empty
-- instead of 'offline' (printed as an empty KETERANGAN cell). An empty row still
-- sits in a room, like offline. Existing rows keep what they have.
-- ==============================================================================

alter table exams drop constraint if exists exams_keterangan_ujian_check;
alter table exams add constraint exams_keterangan_ujian_check
    check (keterangan_ujian in ('', 'offline', 'online', 'take_home', 'project', 'ujian_lisan'));
alter table exams alter column keterangan_ujian set default '';
