-- ==============================================================================
-- Migration: 20261012000001_sessions_jenis_kelas.sql
-- Description: Sesi perkuliahan split per hari into Reguler and Reguler Khusus,
-- so the kuliah form only offers the sessions of the program being scheduled.
-- Existing S1 sessions starting at or after the Reguler Khusus start time become
-- regsus; sesi_ke is renumbered per (prodi, hari, jenis_kelas), keeping order.
-- ==============================================================================

alter table sessions add column if not exists jenis_kelas varchar(10) not null default 'reguler'
    check (jenis_kelas in ('reguler', 'regsus'));

-- S2 runs Reguler only.
alter table sessions drop constraint if exists chk_sessions_s2;
alter table sessions add constraint chk_sessions_s2 check (prodi = 's1' or jenis_kelas = 'reguler');

update sessions
set jenis_kelas = 'regsus'
where prodi = 's1'
  and jam_mulai >= coalesce(
      (select nullif(value, '')::time from settings where key = 'jam_mulai_regsus' and prodi in ('s1', 'all') order by prodi = 's1' desc limit 1),
      '18:00'::time
  );

update sessions s
set sesi_ke = r.n
from (
    select id, row_number() over (partition by prodi, hari, jenis_kelas order by sesi_ke, jam_mulai) as n
    from sessions
) r
where r.id = s.id and s.sesi_ke <> r.n;
