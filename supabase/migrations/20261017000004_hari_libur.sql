-- ==============================================================================
-- Migration: 20261017000004_hari_libur.sql
-- Description: Holidays (faculty-wide). A date with a label that neither
-- prodi claims: kuliah meetings on it are dropped from the .ics feed and the
-- Kalender Gabungan, and entry forms warn when someone schedules ujian/sidang
-- on it. Exams and defenses stay visible wherever they were deliberately
-- placed — warn, never block.
-- ==============================================================================

create table holidays (
    id uuid primary key default gen_random_uuid(),
    -- Unique: a date is either a holiday or it isn't; the label is display data.
    tanggal date not null unique,
    label text not null check (length(trim(label)) between 1 and 120)
);

alter table holidays enable row level security;

create policy holidays_select_authenticated
    on holidays for select
    to authenticated
    using (true);

create policy holidays_insert
    on holidays for insert
    to authenticated
    with check (is_scheduler_or_above());

create policy holidays_update
    on holidays for update
    to authenticated
    using (is_scheduler_or_above())
    with check (is_scheduler_or_above());

create policy holidays_delete
    on holidays for delete
    to authenticated
    using (is_scheduler_or_above());

grant select on holidays to authenticated;

-- The audit trail covers holidays too (who declared, renamed, or recalled one).
do $$
begin
    execute 'drop trigger if exists audit_holidays on holidays';
    execute format(
        'create trigger audit_holidays after insert or update or delete on holidays for each row execute function audit_row()'
    );
end $$;
