-- ==============================================================================
-- Migration: 20261016000003_penguji_eksternal_dosen.sql
-- Description: A sidang's Anggota Penguji I may be a dosen from the master. Then
-- penguji_eksternal_kode holds that dosen and penguji_eksternal stays '', so the
-- sidang shows on the dosen's jadwal link and in the dosen clash check. The form
-- picks Penguji I from the dosen master; penguji_eksternal keeps only names typed
-- before, until a dosen is picked for them.
-- ==============================================================================

alter table defenses
    add column if not exists penguji_eksternal_kode varchar(30) references lecturers(kode_dosen) on update cascade on delete restrict;

-- Names typed before that match exactly one dosen's printed name (lecturerDisplayName,
-- ignoring case and spacing) become that dosen, unless they already hold another role.
with labels as (
    select kode_dosen,
           upper(regexp_replace(btrim(case when gelar_depan <> '' then gelar_depan || ' ' else '' end || nama || btrim(gelar_belakang)), '\s+', ' ', 'g')) as label
    from lecturers
), unique_labels as (
    select label, min(kode_dosen) as kode_dosen from labels group by label having count(*) = 1
)
update defenses d
set penguji_eksternal_kode = u.kode_dosen, penguji_eksternal = ''
from unique_labels u
where d.jenis = 'sidang'
  and d.penguji_eksternal_kode is null
  and upper(regexp_replace(btrim(d.penguji_eksternal), '\s+', ' ', 'g')) = u.label
  and u.kode_dosen is distinct from d.pembimbing_kode
  and u.kode_dosen is distinct from d.penguji_kode;

alter table defenses drop constraint if exists chk_defenses_eksternal_kode;
alter table defenses add constraint chk_defenses_eksternal_kode check (
    penguji_eksternal_kode is null
    or (jenis = 'sidang' and penguji_eksternal = ''
        and penguji_eksternal_kode is distinct from pembimbing_kode
        and penguji_eksternal_kode is distinct from penguji_kode)
);
