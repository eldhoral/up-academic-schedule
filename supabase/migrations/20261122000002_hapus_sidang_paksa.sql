-- Super Admin deletes an S1 sidang that is already graded (nilai_sidang, hasil_sidang, nilai_bimbingan), after
-- typing the student's NPM. The foreign keys to defenses stay "on delete restrict", so the ordinary delete is still
-- refused; only this path removes the grades, all rows in one transaction. The audit_row triggers keep them.
-- An email already sent for the revisi is not undone.
create or replace function hapus_sidang_paksa(p_id uuid, p_npm varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_npm varchar;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat menghapus sidang yang sudah dinilai.'
            using errcode = 'insufficient_privilege';
    end if;
    select npm into v_npm from defenses where id = p_id and prodi = 's1' and jenis = 'sidang' for update;
    if not found then
        raise exception 'Sidang tidak ditemukan.';
    end if;
    if btrim(coalesce(p_npm, '')) <> v_npm then
        raise exception 'NPM tidak cocok.';
    end if;
    delete from nilai_bimbingan where defense_id = p_id;
    delete from hasil_sidang where defense_id = p_id;
    delete from nilai_sidang where defense_id = p_id;
    delete from defenses where id = p_id;
end;
$$;

revoke execute on function hapus_sidang_paksa(uuid, varchar) from public, anon;
grant execute on function hapus_sidang_paksa(uuid, varchar) to authenticated;
