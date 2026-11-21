-- ==============================================================================
-- Migration: 20261121000002_email_revisi_template.sql
-- Description: The S1 sidang revisi email's subject and body become settings the
-- admin edits in Pengaturan (group 'email'). Defaults match the email as sent
-- before. Placeholders: {nama} {npm} {judul} {tanggal} {yudisium} {revisi}.
-- ==============================================================================

insert into settings (key, value, type, "group", label, help, urutan, prodi) values
    ('email_revisi_subjek', 'Revisi Sidang Skripsi — {nama} ({npm})', 'text', 'email', 'Subjek Email Revisi Sidang',
     'Dikirim ke mahasiswa dan penguji saat sidang dikunci. {nama}, {npm}, {judul}, {tanggal}, {yudisium}', 1, 's1'),
    ('email_revisi_isi', E'Nama: {nama}\nNPM: {npm}\nJudul: {judul}\nTanggal sidang: {tanggal}\nYudisium: {yudisium}\n\n{revisi}', 'text', 'email', 'Isi Email Revisi Sidang',
     '{nama}, {npm}, {judul}, {tanggal}, {yudisium}, {revisi} (tabel revisi tiap penguji; bila dihapus, tabel tetap ditambahkan di akhir)', 2, 's1')
on conflict (key, prodi) do nothing;
