-- ==============================================================================
-- Migration: 20261017000003_defense_link.sql
-- Description: A link to the prasidang/sidang material (Google Drive), typed
-- in the Jadwal Sidang form and shown as a button on the public jadwal-dosen
-- page (and carried in the .ics description). Empty = belum ada materi. Only
-- http(s) URLs are accepted — the field renders as a target=_blank button, so
-- a javascript:/data: value would be dangerous.
-- ==============================================================================

alter table defenses add column if not exists link text not null default '';

alter table defenses drop constraint if exists chk_defenses_link;
alter table defenses add constraint chk_defenses_link check (link = '' or link ~* '^https?://');
