-- ==============================================================================
-- Migration: 20260921000003_seed_initial_data.sql
-- Description: Seed initial data for Academic Year (2026/2027 Gasal) and Application Settings
-- Reference: PLAN.md Section 3.1b and Section 6
-- ==============================================================================

-- 1. Academic Year Seed
INSERT INTO academic_years (id, label, is_active)
VALUES ('20261', '2026/2027 Gasal', true)
ON CONFLICT (id) DO UPDATE 
SET label = EXCLUDED.label, 
    is_active = EXCLUDED.is_active;

-- 2. Settings Seed (All default keys from PLAN.md §3.1b)
INSERT INTO settings (key, value, type, "group", label, help, urutan)
VALUES
    -- Waktu & sesi
    ('menit_per_sks', '50', 'int', 'waktu', 'Menit per SKS', 'Durasi standar 1 SKS dalam menit (default: 50 menit)', 1),
    ('jeda_menit', '10', 'int', 'waktu', 'Jeda antar sesi (menit)', 'Jeda istirahat antar sesi perkuliahan berturut-turut', 2),
    ('jam_mulai_reguler', '07:30', 'time', 'waktu', 'Jam mulai kelas reguler', 'Waktu mulai perkuliahan pagi/reguler', 3),
    ('jam_mulai_regsus', '18:00', 'time', 'waktu', 'Jam mulai kelas reguler khusus', 'Waktu mulai perkuliahan sore/malam reguler khusus', 4),
    ('jam_istirahat_mulai', '12:10', 'time', 'waktu', 'Mulai istirahat siang', 'Awal waktu istirahat tengah hari yang dilewati generator sesi', 5),
    ('jam_istirahat_selesai', '13:00', 'time', 'waktu', 'Selesai istirahat siang', 'Akhir waktu istirahat tengah hari yang dilewati generator sesi', 6),
    ('hari_aktif', 'SENIN,SELASA,RABU,KAMIS,JUMAT,SABTU', 'text', 'waktu', 'Hari aktif kuliah', 'Daftar hari yang diaktifkan untuk penjadwalan', 7),

    -- Kelas
    ('kelas_maksimal', 'Z', 'text', 'kelas', 'Batas huruf kelas', 'Huruf kelas maksimal yang ditampilkan pada dropdown pilihan kelas', 1),
    ('maks_mahasiswa_per_kelas', '50', 'int', 'kelas', 'Maksimum mahasiswa per kelas', 'Batas peringatan jumlah mahasiswa per kelas (advisory)', 2),
    ('min_mahasiswa_pilihan', '10', 'int', 'kelas', 'Minimum mahasiswa MK pilihan', 'Batas peringatan kuota minimum peserta kelas pilihan (advisory)', 3),

    -- Bentrok
    ('bentrok_dosen', 'blok', 'text', 'bentrok', 'Penanganan bentrok dosen', 'Tindakan jika jadwal dosen bertabrakan (blok / peringatan / abaikan)', 1),
    ('bentrok_kelas', 'blok', 'text', 'bentrok', 'Penanganan bentrok kelas', 'Tindakan jika jadwal kelas bertabrakan (blok / peringatan / abaikan)', 2),
    ('bentrok_ruangan', 'peringatan', 'text', 'bentrok', 'Penanganan bentrok ruangan', 'Tindakan jika penggunaan ruangan bertabrakan (blok / peringatan / abaikan)', 3),
    ('izinkan_override', 'ya', 'text', 'bentrok', 'Izinkan override bentrok', 'Izinkan admin menyimpan jadwal bentrok dengan alasan khusus (ya / tidak)', 4),

    -- Cetak
    ('nama_universitas', 'Universitas Pancasila', 'text', 'cetak', 'Nama Universitas', 'Nama institusi perguruan tinggi untuk kop dokumen', 1),
    ('nama_fakultas', 'Fakultas Psikologi', 'text', 'cetak', 'Nama Fakultas', 'Nama fakultas untuk kop dokumen', 2),
    ('kota', 'Jakarta', 'text', 'cetak', 'Kota', 'Kota institusi untuk titimangsa tanda tangan', 3),
    ('nama_prodi', 'S1 Psikologi', 'text', 'cetak', 'Nama Program Studi', 'Nama program studi untuk kop dan laporan', 4),
    ('zoom_id', '560 278 1304', 'text', 'cetak', 'Default Zoom ID', 'ID ruang rapat Zoom default untuk perkuliahan daring', 5),
    ('zoom_passcode', '2026', 'text', 'cetak', 'Default Zoom Passcode', 'Passcode ruang rapat Zoom default', 6),
    ('header_baris', E'JADWAL PERKULIAHAN SEMESTER {semester}\nPROGRAM STUDI S1 PSIKOLOGI - ANGKATAN {angkatan}\nTAHUN AKADEMIK {tahun_akademik}', 'text', 'cetak', 'Baris Header Cetak', 'Format teks 4 baris header lembar jadwal cetak', 7),
    ('keterangan_cetak', E'1. WAKTU KULIAH : 1 SKS = 50 MENIT\n2. KELAS GABUNGAN, MAKSIMAL 1 KELAS 50 ORANG\n3. MAHASISWA WAJIB HADIR TEPAT WAKTU', 'text', 'cetak', 'Keterangan Cetak', 'Catatan informasi pada bagian bawah lembar jadwal cetak', 8),
    ('nama_penandatangan', 'FARIDA AINI, M.PSI., PSIKOLOG', 'text', 'cetak', 'Nama Penandatangan', 'Nama lengkap pejabat penandatangan lembar jadwal', 9),
    ('jabatan_penandatangan', 'KETUA PROGRAM STUDI', 'text', 'cetak', 'Jabatan Penandatangan', 'Jabatan resmi penandatangan jadwal', 10),
    ('gambar_tanda_tangan', '', 'image', 'cetak', 'Gambar Tanda Tangan', 'URL atau base64 gambar stempel / tanda tangan (opsional)', 11),
    ('ukuran_kertas', 'A4', 'text', 'cetak', 'Ukuran Kertas', 'Ukuran kertas pencetakan dokumen (A4 / Letter / Legal)', 12),
    ('orientasi', 'portrait', 'text', 'cetak', 'Orientasi Cetak', 'Orientasi kertas pencetakan dokumen (portrait / landscape)', 13)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    type = EXCLUDED.type,
    "group" = EXCLUDED."group",
    label = EXCLUDED.label,
    help = EXCLUDED.help,
    urutan = EXCLUDED.urutan;
