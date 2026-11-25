-- One mata kuliah may belong to several kurikulum; kode_mk stays the primary
-- key so schedules/exams and their (kode_mk, prodi) FKs are untouched.
-- Rollback, if ever needed, loses all but the first membership:
--   alter table courses alter column kurikulum type varchar(20) using kurikulum[1];

-- Normalize the old single values; an empty string is not a membership.
update courses set kurikulum = btrim(kurikulum);
update courses set kurikulum = '2026' where kurikulum = '';

-- b-tree cannot index text[]; drop it before the type change.
drop index if exists idx_courses_kurikulum;

alter table courses alter column kurikulum drop default;

alter table courses
    alter column kurikulum type text[]
    using array[kurikulum::text];

alter table courses
    alter column kurikulum set default array['2026'];

alter table courses
    add constraint chk_courses_kurikulum_not_empty
    check (cardinality(kurikulum) > 0);

create index idx_courses_kurikulum on courses using gin (kurikulum);
