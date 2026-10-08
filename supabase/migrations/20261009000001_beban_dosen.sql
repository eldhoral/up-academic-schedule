-- Lecturer teaching load: the most SKS a dosen should teach in one academic year, and what going over it does.
-- Shared ('all') like the clash policies: a dosen's load counts S1 and S2 together.
insert into settings (key, value, type, "group", label, help, urutan, prodi) values
    ('maks_sks_dosen', '12', 'int', 'bentrok', 'Maksimum SKS dosen',
     'Batas beban mengajar seorang dosen dalam satu tahun akademik, S1 dan S2 dijumlah. Mata kuliah team teaching dihitung penuh untuk setiap dosen.', 5, 'all'),
    ('bentrok_beban', 'peringatan', 'text', 'bentrok', 'Penanganan beban SKS dosen',
     'Tindakan jika beban SKS dosen melebihi batas (blok / peringatan / abaikan)', 6, 'all')
on conflict (key, prodi) do nothing;
