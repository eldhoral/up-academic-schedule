-- ==============================================================================
-- Migration: 20261119000005_grant_service_role_settings.sql
-- Description: The jadwal dosen page and feed read through the admin client
-- (service_role), which bypasses RLS but still needs the table GRANT (same gotcha as
-- 20260924000004). settings and holidays were never granted, so the prasidang Zoom
-- ID/passcode read failed ("permission denied for table settings") and the page fell
-- back to "Kelompok n (Zoom)"; holidays were silently ignored the same way.
-- ==============================================================================

grant select on settings, holidays to service_role;
