-- ==============================================================================
-- Migration: 20261127000001_unvalidasi_simpan_nilai.sql
-- Description: Unvalidasi keeps the examiner's scores (kiprat 2026-11-27): an examiner usually
-- fixes only a few aspek. The grade still leaves nilai_sidang (so every reader, the lock and the
-- recap treat it as not sent, unchanged), but its aspek and revisi are kept in nilai_sidang_draf,
-- and the grading page fills that examiner's form from it. A new Validasi inserts a fresh grade.
-- ==============================================================================

create table if not exists nilai_sidang_draf (
    defense_id uuid not null references defenses(id) on delete cascade,
    peran text not null check (peran in ('anggota_1', 'anggota_2')),
    aspek jsonb not null,
    ada_revisi boolean not null,
    revisi jsonb not null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    primary key (defense_id, peran)
);
-- No policies: only the server (admin client) reads it, only unvalidasi_nilai_sidang writes it.
alter table nilai_sidang_draf enable row level security;
revoke all on nilai_sidang_draf from public, anon, authenticated;

create or replace function unvalidasi_nilai_sidang(p_defense uuid, p_peran text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_peran not in ('anggota_1', 'anggota_2') then
        raise exception 'Sidang tidak ditemukan.' using errcode = 'check_violation';
    end if;
    if not coalesce(my_peran_sidang(p_defense) = 'ketua', false) then
        raise exception 'Hanya Ketua Sidang yang dapat membatalkan validasi nilai.' using errcode = 'insufficient_privilege';
    end if;
    -- A hasil_sidang insert key-share locks this row (its foreign key): a lock in flight finishes first, then is seen below.
    perform 1 from defenses where id = p_defense for update;
    if exists (select 1 from hasil_sidang where defense_id = p_defense) then
        raise exception 'Nilai sidang sudah dikunci.' using errcode = 'insufficient_privilege';
    end if;
    with gone as (
        delete from nilai_sidang where defense_id = p_defense and peran = p_peran
        returning aspek, ada_revisi, revisi
    )
    insert into nilai_sidang_draf (defense_id, peran, aspek, ada_revisi, revisi)
    select p_defense, p_peran, aspek, ada_revisi, revisi from gone
    on conflict (defense_id, peran) do update
        set aspek = excluded.aspek, ada_revisi = excluded.ada_revisi, revisi = excluded.revisi, created_at = excluded.created_at;
    if not found then
        raise exception 'Nilai belum dikirim.' using errcode = 'no_data_found';
    end if;
end;
$$;
