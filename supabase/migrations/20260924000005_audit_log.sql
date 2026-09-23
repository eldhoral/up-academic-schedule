-- ==============================================================================
-- Migration: 20260924000005_audit_log.sql
-- Description: Generic audit trail — one trigger function attached to every
-- data table, logging who changed what and the before/after row. Readable
-- by any authenticated user (same tier as Cetak/Rekap); nobody can edit or
-- delete entries, including SUPERADMIN — it's a log, not a record.
-- ==============================================================================

create table if not exists audit_log (
    id bigint generated always as identity primary key,
    at timestamptz not null default timezone('utc'::text, now()),
    actor_id uuid references auth.users(id) on delete set null,
    actor_email text,
    action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
    table_name text not null,
    record_id text,
    old_data jsonb,
    new_data jsonb
);

create index if not exists idx_audit_log_at on audit_log (at desc);
create index if not exists idx_audit_log_table on audit_log (table_name);
create index if not exists idx_audit_log_actor on audit_log (actor_id);

alter table audit_log enable row level security;

drop policy if exists "audit_log_select_authenticated" on audit_log;
create policy "audit_log_select_authenticated"
    on audit_log for select
    to authenticated
    using (true);

-- No insert/update/delete policy for `authenticated` on purpose — every row
-- comes from the trigger below, which runs as the table owner (postgres) and
-- so isn't subject to RLS. The log is append-only for everyone else.
grant select on audit_log to authenticated;

create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    old_j jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
    new_j jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;
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

do $$
declare
    t text;
begin
    foreach t in array array[
        'academic_years', 'courses', 'lecturers', 'rooms', 'sessions',
        'schedules', 'schedule_lecturers', 'settings', 'profiles'
    ]
    loop
        execute format('drop trigger if exists audit_%I on %I', t, t);
        execute format(
            'create trigger audit_%I after insert or update or delete on %I for each row execute function audit_row()',
            t, t
        );
    end loop;
end $$;
