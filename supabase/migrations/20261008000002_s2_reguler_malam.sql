-- S2 Psikologi Profesi has only Reguler, and its Reguler classes run in the evening.
-- The S2 settings were copied from S1, so S2 started at the S1 morning time (07:30) and
-- carried Reguler Khusus settings nothing reads for S2.

update settings
set value = '18:00', help = 'Waktu mulai perkuliahan reguler S2 (malam)'
where key = 'jam_mulai_reguler' and prodi = 's2' and value = '07:30';

delete from settings where prodi = 's2' and key in ('jam_mulai_regsus', 'sesi_ujian_regsus');
