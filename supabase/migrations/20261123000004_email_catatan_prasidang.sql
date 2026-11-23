-- ==============================================================================
-- Migration: 20261123000004_email_catatan_prasidang.sql
-- Description: The catatan prasidang (the Pendamping's berita acara, as the Form
-- Revisi Prasidang PDF) is emailed to the student and the Dosen Pembimbing
-- Pendamping, Kaprodi and Wakil Dekan I in CC (same Pengaturan settings as the
-- sidang revisi email). Tracked on berita_acara_prasidang like hasil_sidang:
-- email_status / email_detail, written by the server (service_role) only.
-- Rows already submitted are 'tidak_perlu': no mail is sent retroactively.
-- Subject and body are Pengaturan settings like the sidang ones; blank = the
-- built-in default (SUBJEK_PRASIDANG / ISI_PRASIDANG in email-revisi.ts).
-- ==============================================================================

alter table berita_acara_prasidang
    add column if not exists email_status text not null default 'tidak_perlu'
        check (email_status in ('tidak_perlu', 'menunggu', 'terkirim', 'gagal', 'sebagian')),
    add column if not exists email_detail jsonb not null default '[]'::jsonb;
alter table berita_acara_prasidang alter column email_status set default 'menunggu';

-- Same as 20261119000001, plus: a new berita acara always starts 'menunggu' (the dosen cannot set it).
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
        NEW.email_status := 'menunggu';
        NEW.email_detail := '[]'::jsonb;
    end if;
    return NEW;
end;
$$;

grant update (email_status, email_detail) on berita_acara_prasidang to service_role;

insert into settings (key, value, type, "group", label, help, urutan, prodi) values
    ('email_prasidang_subjek', 'Catatan Prasidang Skripsi — {nama} ({npm})', 'text', 'email', 'Subjek Email Catatan Prasidang',
     'Dikirim ke mahasiswa dan Dosen Pembimbing Pendamping saat berita acara prasidang dikirim. {nama}, {npm}, {judul}, {tanggal}, {hasil}, {semester}', 5, 's1'),
    ('email_prasidang_isi', E'Kepada Yth,\n{nama}\n\n\nBerikut dikirimkan Form Revisi (catatan) Prasidang Skripsi\nSemester {semester}.\n\nHasil prasidang: {hasil}\n\nDemikian dan terima kasih.\n\nSalam,\nAkademik F.Psi UP', 'text', 'email', 'Isi Email Catatan Prasidang',
     '{nama}, {npm}, {judul}, {tanggal}, {hasil}, {semester}, {revisi} (catatan per pertanyaan; bila dihapus, catatan hanya ditambahkan di akhir saat lampiran PDF gagal dibuat)', 6, 's1')
on conflict (key, prodi) do nothing;

update settings
   set help = 'Alamat email Kaprodi, ditembuskan (CC) pada email revisi sidang dan catatan prasidang. Kosongkan bila tidak perlu.'
 where key = 'email_revisi_cc_kaprodi' and prodi = 's1';
update settings
   set help = 'Alamat email Wakil Dekan I, ditembuskan (CC) pada email revisi sidang dan catatan prasidang. Kosongkan bila tidak perlu.'
 where key = 'email_revisi_cc_wadek1' and prodi = 's1';
