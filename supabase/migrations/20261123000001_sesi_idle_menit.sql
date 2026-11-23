-- ==============================================================================
-- Migration: 20261123000001_sesi_idle_menit.sql
-- Description: The idle sign-out (no browser activity for N minutes) becomes a
-- shared setting in Pengaturan > Sesi Login. Default 30. Read at sign-in and kept
-- in the `aktif` cookie, so a change applies from each user's next login.
-- ==============================================================================

insert into settings (key, value, type, "group", label, help, urutan, prodi) values
    ('sesi_idle_menit', '30', 'int', 'sesi', 'Keluar Otomatis Setelah Tidak Aktif (menit)',
     'Berlaku untuk semua akun dan kedua prodi, mulai login berikutnya. 5–720 menit; di bawah 5 dianggap 30.', 1, 'all')
on conflict (key, prodi) do nothing;
