-- Reset jadwal: Super Admin wipes one academic year's kuliah, UTS/UAS and sidang/seminar
-- jadwal, per prodi. One function so the whole reset is one transaction: every ticked
-- table empties, or none does. Security invoker, so RLS still applies on top of the check;
-- every deleted row still lands in audit_log through the tables' own triggers.
create or replace function reset_jadwal(p_year text, p_kuliah text[], p_ujian text[], p_sidang text[])
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare k int; u int; s int;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat mereset jadwal.' using errcode = '42501';
    end if;
    -- schedule_lecturers goes with its schedule (on delete cascade).
    delete from schedules where academic_year_id = p_year and prodi = any(p_kuliah);
    get diagnostics k = row_count;
    delete from exams where academic_year_id = p_year and prodi = any(p_ujian);
    get diagnostics u = row_count;
    delete from defenses where academic_year_id = p_year and prodi = any(p_sidang);
    get diagnostics s = row_count;
    return jsonb_build_object('kuliah', k, 'ujian', u, 'sidang', s);
end
$$;

revoke execute on function reset_jadwal(text, text[], text[], text[]) from public;
grant execute on function reset_jadwal(text, text[], text[], text[]) to authenticated;
