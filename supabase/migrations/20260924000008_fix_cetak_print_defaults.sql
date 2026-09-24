-- Align the Cetak Jadwal header and KETERANGAN text with the faculty's
-- reference document. The seed file was corrected too, but it already ran
-- against existing databases, so the live rows need updating here.
-- {tahun} = year range only (e.g. 2026/2027), {term} = GASAL/GENAP.
update settings
set value = E'JADWAL KULIAH SEMESTER {semester}\nANGKATAN {angkatan}\nSEMESTER {term} TAHUN AKADEMIK {tahun}'
where key = 'header_baris';

update settings
set value = E'MK DENGAN BINTANG (*) ADALAH MATA KULIAH PILIHAN\nMATA KULIAH PILIHAN DIBUKA DENGAN MINIMAL MAHASISWA 10 ORANG\nKELAS GABUNGAN, MAKSIMAL 1 KELAS 50 ORANG, JIKA LEBIH DIBUKA KELAS BARU'
where key = 'keterangan_cetak';
