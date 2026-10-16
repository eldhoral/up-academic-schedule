-- ==============================================================================
-- Migration: 20261017000002_wakil_dekan_semua_jadwal.sql
-- Description: Wakil Dekan I now also signs the jadwal kuliah and UTS/UAS sheets;
-- the settings help says so. Text only, no schema change.
-- ==============================================================================

update settings set help = 'Penandatangan "Mengetahui" pada jadwal kuliah, UTS/UAS, prasidang dan sidang' where key = 'nama_wakil_dekan';
