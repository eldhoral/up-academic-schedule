-- ==============================================================================
-- Migration: 20261119000001_berita_acara_prasidang.sql
-- Description: Berita Acara Prasidang (S1). The two prasidang dosen (Pembimbing
-- Pendamping = pembimbing_kode, Pembahas = penguji_kode) each submit one berita
-- acara with a verdict. An S1 sidang may be scheduled only when the student's
-- latest prasidang has both, neither tidak layak, or Super Admin overrode it
-- (keputusan_prasidang). All existing S1 prasidang/sidang data was test data
-- and is deleted first (user decision, 2026-11-19).
-- ==============================================================================

-- 1. Cleanup ---------------------------------------------------------------------------
-- Owner-only. Children first: the grade tables are on delete restrict and nobody may delete through RLS.
create or replace function hapus_data_sidang_s1()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from hasil_sidang where defense_id in (select id from defenses where prodi = 's1');
    delete from nilai_sidang where defense_id in (select id from defenses where prodi = 's1');
    delete from nilai_bimbingan where defense_id in (select id from defenses where prodi = 's1');
    -- EKSTERNAL day accounts exist only for S1 sidang; deleting the user cascades akun_eksternal and profiles.
    delete from auth.users where id in (select user_id from akun_eksternal);
    delete from defenses where prodi = 's1';
end;
$$;
revoke execute on function hapus_data_sidang_s1() from public, anon, authenticated;

-- Runs once: the next migrations' tables don't exist yet, so this never touches berita acara.
do $$ begin
    if not exists (select 1 from information_schema.tables where table_name = 'berita_acara_prasidang') then
        perform hapus_data_sidang_s1();
    end if;
end $$;

-- 2. Rules -----------------------------------------------------------------------------
alter table aturan_penilaian drop constraint if exists chk_aturan_penilaian_kunci;
alter table aturan_penilaian add constraint chk_aturan_penilaian_kunci
    check (kunci in ('aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian',
                     'aspek_sidang', 'pilihan_yudisium', 'pertanyaan_prasidang', 'batas_hari_bimbingan'));

insert into aturan_penilaian (prodi, kunci, nilai) values
    -- ya_tidak: Ya/Tidak + optional catatan; uraian: a required text answer (the Google Form's two text fields).
    ('s1', 'pertanyaan_prasidang', '[
        {"teks": "Apakah Variabel Penelitian dapat dipertahankan?", "jenis": "ya_tidak"},
        {"teks": "Apakah terdapat perubahan pertanyaan penelitian?", "jenis": "ya_tidak"},
        {"teks": "Apakah alat ukur yang diusulkan dapat digunakan untuk penelitian ini?", "jenis": "ya_tidak"},
        {"teks": "Sistematika Penulisan Proposal", "jenis": "uraian"},
        {"teks": "Substansi (isi) Proposal", "jenis": "uraian"}
    ]'::jsonb),
    ('s1', 'batas_hari_bimbingan', '7'::jsonb)
on conflict (prodi, kunci) do nothing;

-- 3. Berita acara ------------------------------------------------------------------------
-- jawaban is the snapshot [{teks, jenis, ya, catatan}] the dosen answered (ya is null for an uraian).
create table if not exists berita_acara_prasidang (
    id uuid primary key default gen_random_uuid(),
    defense_id uuid not null references defenses(id) on delete restrict,
    kode_dosen varchar(30) not null references lecturers(kode_dosen) on update cascade,
    peran text not null check (peran in ('pendamping', 'pembahas')),
    jawaban jsonb not null,
    hasil text not null check (hasil in ('layak', 'layak_revisi', 'tidak_layak')),
    submitted_at timestamptz not null default timezone('utc'::text, now()),
    submitted_by uuid default auth.uid() references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    unique (defense_id, peran)
);

drop trigger if exists update_berita_acara_prasidang_updated_at on berita_acara_prasidang;
create trigger update_berita_acara_prasidang_updated_at
    before update on berita_acara_prasidang
    for each row execute function update_updated_at_column();

drop trigger if exists audit_berita_acara_prasidang on berita_acara_prasidang;
create trigger audit_berita_acara_prasidang
    after insert or update or delete on berita_acara_prasidang
    for each row execute function audit_row();

-- Shape and target. Timestamps are the DB's, never the client's.
create or replace function cek_berita_acara()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if jsonb_typeof(NEW.jawaban) is distinct from 'array' or jsonb_array_length(NEW.jawaban) = 0
        or exists (
            select 1 from jsonb_array_elements(NEW.jawaban) j
            where not (
                jsonb_typeof(j) = 'object'
                and coalesce(jsonb_typeof(j -> 'teks') = 'string' and btrim(j ->> 'teks') <> '', false)
                and coalesce(jsonb_typeof(j -> 'catatan') = 'string', false)
                and case j ->> 'jenis'
                    when 'ya_tidak' then coalesce(jsonb_typeof(j -> 'ya') = 'boolean' and length(j ->> 'catatan') <= 1000, false)
                    when 'uraian' then coalesce(jsonb_typeof(j -> 'ya') = 'null' and btrim(j ->> 'catatan') <> ''
                                                and length(j ->> 'catatan') <= 2000, false)
                    else false
                end
            )
        ) then
        raise exception 'Berita acara tidak valid.' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from defenses where id = NEW.defense_id and prodi = 's1' and jenis = 'prasidang') then
        raise exception 'Berita acara hanya untuk prasidang S1.' using errcode = 'check_violation';
    end if;
    if TG_OP = 'INSERT' then
        NEW.submitted_at := timezone('utc'::text, now());
        NEW.created_at := NEW.submitted_at;
    end if;
    return NEW;
end;
$$;

drop trigger if exists cek_berita_acara on berita_acara_prasidang;
create trigger cek_berita_acara
    before insert or update on berita_acara_prasidang
    for each row execute function cek_berita_acara();

-- The caller is the DOSEN holding that peran on an S1 prasidang dated today (Jakarta) or earlier.
create or replace function may_isi_berita_acara(p_defense uuid, p_peran text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from defenses d
        where d.id = p_defense
          and d.prodi = 's1' and d.jenis = 'prasidang'
          and my_kode_dosen() = case p_peran when 'pendamping' then d.pembimbing_kode
                                             when 'pembahas' then d.penguji_kode end
          and (now() at time zone 'Asia/Jakarta')::date >= d.tanggal
    )
$$;

alter table berita_acara_prasidang enable row level security;

drop policy if exists berita_acara_prasidang_select on berita_acara_prasidang;
create policy berita_acara_prasidang_select on berita_acara_prasidang for select to authenticated
    using ((select is_staff()) or kode_dosen = (select my_kode_dosen()));
drop policy if exists berita_acara_prasidang_insert on berita_acara_prasidang;
create policy berita_acara_prasidang_insert on berita_acara_prasidang for insert to authenticated with check (
    may_isi_berita_acara(defense_id, peran) and kode_dosen = (select my_kode_dosen()) and submitted_by = auth.uid()
);
-- No update or delete policy: a berita acara is final. Super Admin overrides the verdict instead.

revoke all on berita_acara_prasidang from anon, authenticated;
grant select, insert on berita_acara_prasidang to authenticated;
grant select on berita_acara_prasidang to service_role;

-- 4. Super Admin's verdict override, per student ------------------------------------------
-- prasidang_id = the student's latest prasidang when it was set (null: none). It applies only
-- while that is still the latest, so a newer prasidang decides again.
create table if not exists keputusan_prasidang (
    npm varchar(20) primary key references students(npm) on update cascade on delete cascade,
    prasidang_id uuid null references defenses(id) on delete set null,
    hasil text not null check (hasil in ('layak', 'layak_revisi')),
    alasan text not null check (btrim(alasan) <> ''),
    oleh uuid default auth.uid() references auth.users(id) on delete set null,
    pada timestamptz not null default timezone('utc'::text, now())
);

create or replace function set_keputusan_prasidang()
returns trigger
language plpgsql
as $$
begin
    NEW.pada := timezone('utc'::text, now());
    NEW.oleh := auth.uid();
    return NEW;
end;
$$;

drop trigger if exists set_keputusan_prasidang on keputusan_prasidang;
create trigger set_keputusan_prasidang
    before insert or update on keputusan_prasidang
    for each row execute function set_keputusan_prasidang();

drop trigger if exists audit_keputusan_prasidang on keputusan_prasidang;
create trigger audit_keputusan_prasidang
    after insert or update or delete on keputusan_prasidang
    for each row execute function audit_row();

alter table keputusan_prasidang enable row level security;

drop policy if exists keputusan_prasidang_select on keputusan_prasidang;
create policy keputusan_prasidang_select on keputusan_prasidang for select to authenticated using ((select is_staff()));
drop policy if exists keputusan_prasidang_insert on keputusan_prasidang;
create policy keputusan_prasidang_insert on keputusan_prasidang for insert to authenticated with check (is_superadmin());
drop policy if exists keputusan_prasidang_update on keputusan_prasidang;
create policy keputusan_prasidang_update on keputusan_prasidang for update to authenticated using (is_superadmin()) with check (is_superadmin());
drop policy if exists keputusan_prasidang_delete on keputusan_prasidang;
create policy keputusan_prasidang_delete on keputusan_prasidang for delete to authenticated using (is_superadmin());

revoke all on keputusan_prasidang from anon, authenticated;
grant select, insert, update, delete on keputusan_prasidang to authenticated;
grant select on keputusan_prasidang to service_role;

-- 5. Status and gate ---------------------------------------------------------------------
-- layak | layak_revisi | tidak_layak | belum_lengkap | tidak_ada. Same rules as statusPrasidang() in TS.
-- Staff only for a signed-in session (a DOSEN or EKSTERNAL gets null): the verdict is staff data. The
-- role setting, not current_user, tells who called: inside security definer current_user is the owner.
create or replace function status_prasidang(p_npm varchar)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    pras uuid;
    k text;
    a text;
    b text;
begin
    if current_setting('role', true) in ('authenticated', 'anon') and not is_staff() then return null; end if;
    select id into pras from defenses
    where npm = p_npm and prodi = 's1' and jenis = 'prasidang'
    order by tanggal desc, created_at desc
    limit 1;

    select hasil into k from keputusan_prasidang where npm = p_npm and prasidang_id is not distinct from pras;
    if k is not null then return k; end if;
    if pras is null then return 'tidak_ada'; end if;

    select hasil into a from berita_acara_prasidang where defense_id = pras and peran = 'pendamping';
    select hasil into b from berita_acara_prasidang where defense_id = pras and peran = 'pembahas';
    if a is null or b is null then return 'belum_lengkap'; end if;
    if 'tidak_layak' in (a, b) then return 'tidak_layak'; end if;
    if 'layak_revisi' in (a, b) then return 'layak_revisi'; end if;
    return 'layak';
end;
$$;
revoke execute on function status_prasidang(varchar) from public, anon;
grant execute on function status_prasidang(varchar) to authenticated, service_role;

-- Security invoker on purpose: current_user is then 'authenticated' for a signed-in session
-- (the role PostgREST switches to), and the owner or service_role otherwise.
-- ponytail: migrations, the service role and postgres are trusted; the gate stops signed-in sessions.
create or replace function gerbang_sidang()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    s text;
begin
    if current_user not in ('authenticated', 'anon') then return NEW; end if;
    if NEW.prodi <> 's1' or NEW.jenis <> 'sidang' then return NEW; end if;
    if TG_OP = 'UPDATE' and (NEW.npm, NEW.jenis, NEW.prodi) is not distinct from (OLD.npm, OLD.jenis, OLD.prodi) then
        return NEW;
    end if;
    s := status_prasidang(NEW.npm);
    if s = 'tidak_ada' then
        raise exception 'Mahasiswa belum memiliki prasidang. Super Admin dapat memberi keputusan di Data Mahasiswa.' using errcode = 'check_violation';
    elsif s = 'belum_lengkap' then
        raise exception 'Berita acara prasidang belum lengkap.' using errcode = 'check_violation';
    elsif s = 'tidak_layak' then
        raise exception 'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.' using errcode = 'check_violation';
    end if;
    return NEW;
end;
$$;

drop trigger if exists gerbang_sidang on defenses;
create trigger gerbang_sidang
    before insert or update of npm, jenis, prodi on defenses
    for each row execute function gerbang_sidang();

-- 6. Defense lock ------------------------------------------------------------------------
-- From 20261116000001: the prasidang part now follows berita acara, not nilai_bimbingan
-- (bimbingan moves to the sidang in the next migration). Sidang clauses unchanged.
create or replace function lock_graded_defense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.npm is distinct from OLD.npm or NEW.jenis is distinct from OLD.jenis or NEW.prodi is distinct from OLD.prodi then
        if exists (select 1 from berita_acara_prasidang where defense_id = OLD.id) then
            raise exception 'Mahasiswa tidak dapat diubah: prasidang ini sudah diisi berita acaranya.';
        end if;
        if exists (select 1 from nilai_sidang where defense_id = OLD.id)
                or exists (select 1 from nilai_bimbingan where defense_id = OLD.id) then
            raise exception 'Mahasiswa tidak dapat diubah: sidang ini sudah dinilai.';
        end if;
    end if;
    -- The latest prasidang decides the gate, so a filled one keeps its date.
    if NEW.tanggal is distinct from OLD.tanggal and exists (select 1 from berita_acara_prasidang where defense_id = OLD.id) then
        raise exception 'Tanggal tidak dapat diubah: prasidang ini sudah diisi berita acaranya.';
    end if;
    if (NEW.pembimbing_kode is distinct from OLD.pembimbing_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_kode)
            and exists (select 1 from berita_acara_prasidang where defense_id = OLD.id and peran = 'pendamping'))
        or (NEW.penguji_kode is distinct from OLD.penguji_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_kode)
            and exists (select 1 from berita_acara_prasidang where defense_id = OLD.id and peran = 'pembahas')) then
        raise exception 'Dosen pembimbing tidak dapat diubah: prasidang ini sudah diisi berita acaranya.';
    end if;
    if (NEW.tanggal is distinct from OLD.tanggal
            and exists (select 1 from nilai_sidang where defense_id = OLD.id))
        or (NEW.penguji_kode is distinct from OLD.penguji_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'ketua'))
        or (NEW.penguji_eksternal_kode is distinct from OLD.penguji_eksternal_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.penguji_eksternal_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'anggota_1'))
        or (NEW.pembimbing_kode is distinct from OLD.pembimbing_kode
            and exists (select 1 from lecturers where kode_dosen = OLD.pembimbing_kode)
            and exists (select 1 from nilai_sidang where defense_id = OLD.id and peran = 'anggota_2')) then
        raise exception 'Penguji/tanggal tidak dapat diubah: sidang ini sudah dinilai.';
    end if;
    return NEW;
end;
$$;
