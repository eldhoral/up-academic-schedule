-- The UTS/UAS, prasidang and sidang print titles are one line per row ("\n"-separated).
-- Some databases ended up with these values on a single line, which prints every title line
-- run together in one cell. Restore the default multi-line templates wherever a value has no
-- line break at all; templates that already have line breaks (including edited ones) are kept.

update settings set value = E'JADWAL EVALUASI {ujian} SEMESTER\nSEMESTER {semester}{program} ANGKATAN {angkatan_ta}\nSEMESTER {term} TAHUN AKADEMIK {tahun}'
where key = 'ujian_header_baris' and value !~ '[\r\n]';

update settings set value = case prodi
        when 's2' then E'JADWAL SEMINAR PROPOSAL TESIS SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nKELOMPOK {kelompok}'
        else E'JADWAL PRASIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nKELOMPOK {kelompok}'
    end
where key = 'prasidang_header_baris' and value !~ '[\r\n]';

update settings set value = case prodi
        when 's2' then E'JADWAL SIDANG TESIS SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nRUANG {ruang}\nFAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA'
        else E'JADWAL SIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nRUANG {ruang}\nFAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA'
    end
where key = 'sidang_header_baris' and value !~ '[\r\n]';
