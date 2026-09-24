-- Settings for the Surat Penugasan Pengampu Mata Kuliah (Rekap Dosen letter).
-- Values are drawn from docs/Draft Surat Penugasan Pengampu Dosen MK Gasal 26-27.docx
-- and docs/Kop Surat.doc; nomor_surat and catatan_perkuliahan change every
-- semester and are expected to be updated by staff before each export.

INSERT INTO settings (key, value, type, "group", label, help, urutan)
VALUES
    ('kop_baris', E'FAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA\nGedung Fakultas Psikologi\nSrengseng Sawah – Lenteng Agung, Jagakarsa Jakarta Selatan 12640\nTelp. 021 – 7872462   |   Website: http://psikologi.univpancasila.ac.id\nE-mail: psikologiup@univpancasila.ac.id', 'text', 'surat', 'Baris Kop Surat', 'Format teks kop surat (baris pertama tebal, sisanya alamat/kontak)', 1),
    ('nomor_surat', '', 'text', 'surat', 'Nomor Surat', 'Nomor surat penugasan, diperbarui setiap kali surat dibuat', 2),
    ('lampiran_surat', '', 'text', 'surat', 'Lampiran', 'Isi baris Lampiran pada surat (boleh dikosongkan)', 3),
    ('perihal_surat', 'Penugasan Pengampu Mata Kuliah', 'text', 'surat', 'Perihal', 'Isi baris Perihal pada surat', 4),
    ('catatan_perkuliahan', 'Perkuliahan telah dilaksanakan pada hari Senin, 7 September 2026. Khusus bagi mahasiswa baru, perkuliahan akan dimulai pada hari Senin, 21 September 2026.', 'text', 'surat', 'Catatan Perkuliahan', 'Paragraf catatan tanggal mulai perkuliahan, perbarui setiap semester', 5),
    ('nama_dekan', 'Prof. Dr. Awaluddin Tjalla, M.Pd., M.Psi', 'text', 'surat', 'Nama Dekan', 'Nama lengkap Dekan penandatangan surat penugasan', 6),
    ('jabatan_dekan', 'Dekan', 'text', 'surat', 'Jabatan Dekan', 'Jabatan penandatangan surat penugasan', 7),
    ('gambar_tanda_tangan_dekan', '', 'image', 'surat', 'Gambar Tanda Tangan Dekan', 'URL atau base64 gambar stempel / tanda tangan Dekan (opsional)', 8),
    ('tembusan', E'Para Wadek;\nKa. Prodi;\nKabag/Kasubbag Akademik;\nKabag Umum, Keuangan, Kepegawaian dan Aset;\nArsip.', 'text', 'surat', 'Tembusan', 'Daftar tembusan surat, satu baris per tujuan', 9)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    type = EXCLUDED.type,
    "group" = EXCLUDED."group",
    label = EXCLUDED.label,
    help = EXCLUDED.help,
    urutan = EXCLUDED.urutan;
