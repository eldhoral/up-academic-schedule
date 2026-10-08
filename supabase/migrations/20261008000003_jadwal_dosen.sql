-- Jadwal dosen: a secret link per lecturer (no login) and a calendar feed.
-- Term dates place the weekly kuliah on a calendar; the token identifies the lecturer;
-- the public routes read through the service role, which needs table grants (RLS bypass
-- does not replace them); the audit trail never stores the token.

alter table academic_years
    add column if not exists mulai_kuliah date,
    add column if not exists selesai_kuliah date;
alter table academic_years drop constraint if exists chk_academic_years_kuliah;
alter table academic_years add constraint chk_academic_years_kuliah
    check (mulai_kuliah is null or selesai_kuliah is null or selesai_kuliah >= mulai_kuliah);

alter table lecturers add column if not exists jadwal_token text unique;

grant select on lecturers, academic_years, schedules, schedule_lecturers, courses, rooms, exams, defenses to service_role;

-- Same as 20260924000005_audit_log.sql, minus the jadwal_token key.
create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    old_j jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) - 'jadwal_token' else null end;
    new_j jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) - 'jadwal_token' else null end;
    rid text := coalesce(
        new_j ->> 'id', old_j ->> 'id',
        new_j ->> 'kode_mk', old_j ->> 'kode_mk',
        new_j ->> 'kode_dosen', old_j ->> 'kode_dosen',
        new_j ->> 'key', old_j ->> 'key'
    );
    actor uuid := auth.uid();
    actor_mail text;
begin
    if actor is not null then
        select email into actor_mail from auth.users where id = actor;
    end if;

    insert into audit_log (actor_id, actor_email, action, table_name, record_id, old_data, new_data)
    values (actor, actor_mail, TG_OP, TG_TABLE_NAME, rid, old_j, new_j);

    return coalesce(NEW, OLD);
end;
$$;
