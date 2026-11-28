-- ==============================================================================
-- Migration: 20261128000002_email_s2_tesis.sql
-- Description: S2's email templates still said "skripsi" where S1's said "Prasidang Skripsi"
-- (20261128000001 reworded only "Sidang Skripsi" and "prasidang"): "Catatan Seminar Proposal
-- Skripsi" becomes "Catatan Seminar Proposal Tesis". S2 only; S1's templates are untouched.
-- ==============================================================================

update settings
set value = replace(replace(replace(value, 'SKRIPSI', 'TESIS'), 'Skripsi', 'Tesis'), 'skripsi', 'tesis'),
    label = replace(replace(replace(label, 'SKRIPSI', 'TESIS'), 'Skripsi', 'Tesis'), 'skripsi', 'tesis'),
    help = replace(replace(replace(help, 'SKRIPSI', 'TESIS'), 'Skripsi', 'Tesis'), 'skripsi', 'tesis')
where prodi = 's2'
  and key in ('email_revisi_subjek', 'email_revisi_isi', 'email_revisi_cc_kaprodi', 'email_revisi_cc_wadek1',
              'email_prasidang_subjek', 'email_prasidang_isi');
