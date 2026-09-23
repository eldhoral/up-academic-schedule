-- Allow MINGGU (Sunday) as a valid teaching day, alongside SENIN..SABTU.
alter table sessions drop constraint if exists sessions_hari_check;
alter table sessions add constraint sessions_hari_check
    check (hari in ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'));

alter table schedules drop constraint if exists schedules_hari_check;
alter table schedules add constraint schedules_hari_check
    check (hari in ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'));
