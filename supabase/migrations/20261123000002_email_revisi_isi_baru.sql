-- ==============================================================================
-- Migration: 20261123000002_email_revisi_isi_baru.sql
-- Description: New body for the S1 sidang revisi email (Kepada Yth ... Akademik
-- F.Psi UP). Adds the {semester} placeholder ("Genap TA. 2025/2026", from the
-- sidang's academic year). The revisi tables now travel in the attached form PDF;
-- they are added to the body only when the PDF could not be made, or via {revisi}.
-- Kaprodi and Wakil Dekan I get the mail in CC; blank = not CC'd.
-- ==============================================================================

update settings
   set value = E'Kepada Yth,\n{nama}\n\n\nBerikut dikirimkan Form Revisi Sidang Skripsi\nSemester {semester}.\n\nDemikian dan terima kasih.\n\nSalam,\nAkademik F.Psi UP',
       help = '{nama}, {npm}, {judul}, {tanggal}, {yudisium}, {semester} (mis. Genap TA. 2025/2026), {revisi} (tabel revisi tiap penguji; bila dihapus, tabel hanya ditambahkan di akhir saat lampiran PDF gagal dibuat)'
 where key = 'email_revisi_isi' and prodi = 's1';

update settings
   set help = 'Dikirim ke mahasiswa dan penguji saat sidang dikunci. {nama}, {npm}, {judul}, {tanggal}, {yudisium}, {semester}'
 where key = 'email_revisi_subjek' and prodi = 's1';

insert into settings (key, value, type, "group", label, help, urutan, prodi) values
    ('email_revisi_cc_kaprodi', '', 'text', 'email', 'CC Email Kaprodi',
     'Alamat email Kaprodi, ditembuskan (CC) pada email revisi sidang. Kosongkan bila tidak perlu.', 3, 's1'),
    ('email_revisi_cc_wadek1', '', 'text', 'email', 'CC Email Wakil Dekan I',
     'Alamat email Wakil Dekan I, ditembuskan (CC) pada email revisi sidang. Kosongkan bila tidak perlu.', 4, 's1')
on conflict (key, prodi) do nothing;
