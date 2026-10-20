-- ==============================================================================
-- Migration: 20261020000001_ujian_cetak_settings.sql
-- Description: The UTS/UAS preview says "Ubah di Pengaturan", but its note was
-- hardcoded, its paper ignored the settings, and the signers sat in unrelated
-- groups. Add the exam note and paper settings, and group every signer together
-- so the preview's values map to a visible section.
-- ==============================================================================

-- Per prodi, like the other ujian settings (20261002000001_exams.sql).
insert into settings (key, value, type, "group", label, help, urutan, prodi)
values
    ('catatan_ujian', 'Note: Jika Dosen Pengawas berhalangan hadir mohon memberikan info ke akademik maksimal H-2 dari jadwal ujian', 'text', 'ujian', 'Catatan Bawah Jadwal Ujian', 'Catatan yang dicetak di bawah tabel jadwal UTS/UAS', 5, 's1'),
    ('ukuran_kertas_ujian', 'A4', 'text', 'ujian', 'Ukuran Kertas Ujian', 'Ukuran kertas hasil cetak UTS/UAS (A4 / Letter / Legal)', 6, 's1'),
    ('orientasi_ujian', 'landscape', 'text', 'ujian', 'Orientasi Kertas Ujian', 'Orientasi kertas hasil cetak UTS/UAS (landscape / portrait)', 7, 's1'),
    ('catatan_ujian', 'Note: Jika Dosen Pengawas berhalangan hadir mohon memberikan info ke akademik maksimal H-2 dari jadwal ujian', 'text', 'ujian', 'Catatan Bawah Jadwal Ujian', 'Catatan yang dicetak di bawah tabel jadwal UTS/UAS', 5, 's2'),
    ('ukuran_kertas_ujian', 'A4', 'text', 'ujian', 'Ukuran Kertas Ujian', 'Ukuran kertas hasil cetak UTS/UAS (A4 / Letter / Legal)', 6, 's2'),
    ('orientasi_ujian', 'landscape', 'text', 'ujian', 'Orientasi Kertas Ujian', 'Orientasi kertas hasil cetak UTS/UAS (landscape / portrait)', 7, 's2')
on conflict (key, prodi) do nothing;

-- Signers read as one block in Pengaturan, matching the "Mengetahui" and
-- "Penandatangan" rows on every print preview.
update settings
set "group" = 'tanda_tangan',
    urutan = case key
        when 'nama_wakil_dekan' then 1
        when 'jabatan_wakil_dekan' then 2
        when 'nama_penandatangan' then 3
        when 'jabatan_penandatangan' then 4
        when 'gambar_tanda_tangan' then 5
    end
where key in (
    'nama_wakil_dekan', 'jabatan_wakil_dekan',
    'nama_penandatangan', 'jabatan_penandatangan',
    'gambar_tanda_tangan'
);

-- Match the "Mengetahui" block the print previews show.
update settings set label = 'Nama Wakil Dekan I (Mengetahui)' where key = 'nama_wakil_dekan';

-- The remaining paper settings belong to the kuliah sheet; UTS/UAS has its own.
update settings
set label = 'Ukuran Kertas Jadwal Kuliah',
    help = 'Ukuran kertas hasil cetak jadwal kuliah (A4 / Letter / Legal)'
where key = 'ukuran_kertas';

update settings
set label = 'Orientasi Kertas Jadwal Kuliah',
    help = 'Orientasi kertas hasil cetak jadwal kuliah (portrait / landscape)'
where key = 'orientasi';
