-- Super Admin deletes an S1 prasidang whose berita acara is already filled, after typing the student's NPM.
-- berita_acara_prasidang -> defenses stays "on delete restrict", so the ordinary delete is still refused; only this
-- path removes a filled berita acara, both rows in one transaction. The audit_row triggers keep the deleted rows.
create or replace function hapus_prasidang_paksa(p_id uuid, p_npm varchar)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_npm varchar;
begin
    if not is_superadmin() then
        raise exception 'Hanya Super Admin yang dapat menghapus prasidang yang sudah diisi berita acaranya.'
            using errcode = 'insufficient_privilege';
    end if;
    select npm into v_npm from defenses where id = p_id and prodi = 's1' and jenis = 'prasidang' for update;
    if not found then
        raise exception 'Prasidang tidak ditemukan.';
    end if;
    if btrim(coalesce(p_npm, '')) <> v_npm then
        raise exception 'NPM tidak cocok.';
    end if;
    delete from berita_acara_prasidang where defense_id = p_id;
    delete from defenses where id = p_id;
end;
$$;

revoke execute on function hapus_prasidang_paksa(uuid, varchar) from public, anon;
grant execute on function hapus_prasidang_paksa(uuid, varchar) to authenticated;
