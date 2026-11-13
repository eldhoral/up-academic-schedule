import type { SupabaseClient } from '@supabase/supabase-js'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { Peran, PeranSidang } from './akses'
import { loadAturan, type Aturan } from './aturan'
import { bimbinganTerbaru, buildRekapAkhir, buildRekapBimbingan, type RekapAkhir, type RekapBimbingan } from './rekap'

export type TahunAkademik = { id: string; label: string }

/** Every tahun akademik (newest first) and the one asked for: `raw` if it exists, else the active one, else the newest. */
export async function pilihTahun(db: SupabaseClient, raw: string | null | undefined): Promise<{ years: TahunAkademik[]; ay: string }> {
  const { data, error } = await db.from('academic_years').select('id, label, is_active').order('id', { ascending: false })
  if (error) throw new Error(`Gagal memuat tahun akademik: ${error.message}`)
  const years = (data ?? []) as (TahunAkademik & { is_active: boolean })[]
  const ay = years.find((y) => y.id === raw)?.id ?? years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  return { years, ay }
}

/** The recap of one tahun akademik. Session client: RLS (is_staff) decides who may read. Any DB error throws. */
export async function loadRekapBimbingan(db: SupabaseClient, ay: string): Promise<{ rows: RekapBimbingan[]; aturan: Aturan }> {
  const [d, s, l, aturan] = await Promise.all([
    db.from('defenses').select('id, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode')
      .eq('prodi', 's1').eq('jenis', 'prasidang').eq('academic_year_id', ay),
    db.from('students').select('npm, sks_sebelum, bobot_sebelum').eq('prodi', 's1'),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    loadAturan(db, 's1'),
  ])
  const err = d.error ?? s.error ?? l.error
  if (err) throw new Error(`Gagal memuat rekap nilai bimbingan: ${err.message}`)
  const defenses = d.data ?? []

  const n = defenses.length
    ? await db.from('nilai_bimbingan').select('defense_id, peran, nilai, sumber').in('defense_id', defenses.map((x) => x.id))
    : { data: [], error: null }
  if (n.error) throw new Error(`Gagal memuat rekap nilai bimbingan: ${n.error.message}`)

  const nama = new Map((l.data ?? []).map((x) => [x.kode_dosen as string, lecturerDisplayName(x)]))
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  const rows = buildRekapBimbingan(
    defenses,
    (s.data ?? []).map((x) => ({ npm: x.npm, sks_sebelum: num(x.sks_sebelum), bobot_sebelum: num(x.bobot_sebelum) })),
    (n.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as Peran, nilai: Number(x.nilai), sumber: x.sumber as 'dosen' | 'manual' })),
    (kode) => nama.get(kode) ?? kode,
  )
  return { rows, aturan }
}

/**
 * The Nilai Akhir recap of one tahun akademik. Session client: RLS (is_staff) decides who may read. Any DB error throws.
 * Bimbingan is looked up by the NPMs on the page only, across every year (the latest prasidang of each NPM on or before the sidang decides).
 */
export async function loadRekapAkhir(db: SupabaseClient, ay: string): Promise<RekapAkhir[]> {
  const [d, s, l, n, h] = await Promise.all([
    db.from('defenses').select('id, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode, penguji_eksternal_kode')
      .eq('prodi', 's1').eq('jenis', 'sidang').eq('academic_year_id', ay),
    db.from('students').select('npm, sks_sebelum, bobot_sebelum, tepat_waktu').eq('prodi', 's1'),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    db.from('nilai_sidang').select('defense_id, peran, nilai, defenses!inner(academic_year_id)').eq('defenses.academic_year_id', ay),
    db.from('hasil_sidang')
      .select('defense_id, yudisium_label, yudisium_lulus, aturan, locked_at, email_status, email_detail, defenses!inner(academic_year_id)')
      .eq('defenses.academic_year_id', ay),
  ])
  const err = d.error ?? s.error ?? l.error ?? n.error ?? h.error
  if (err) throw new Error(`Gagal memuat rekap nilai akhir: ${err.message}`)
  const sidang = d.data ?? []

  const npms = [...new Set(sidang.map((x) => x.npm as string))]
  const pra = npms.length
    ? await db.from('defenses').select('id, tanggal, npm').eq('prodi', 's1').eq('jenis', 'prasidang').in('npm', npms)
    : { data: [], error: null }
  if (pra.error) throw new Error(`Gagal memuat rekap nilai akhir: ${pra.error.message}`)
  const nb = (pra.data ?? []).length
    ? await db.from('nilai_bimbingan').select('defense_id, peran, nilai').in('defense_id', (pra.data ?? []).map((x) => x.id))
    : { data: [], error: null }
  if (nb.error) throw new Error(`Gagal memuat rekap nilai akhir: ${nb.error.message}`)

  const nama = new Map((l.data ?? []).map((x) => [x.kode_dosen as string, lecturerDisplayName(x)]))
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return buildRekapAkhir(
    sidang,
    (s.data ?? []).map((x) => ({ npm: x.npm, sks_sebelum: num(x.sks_sebelum), bobot_sebelum: num(x.bobot_sebelum), tepat_waktu: !!x.tepat_waktu })),
    (n.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as PeranSidang, nilai: Number(x.nilai) })),
    (h.data ?? []).map((x) => ({
      defense_id: x.defense_id, yudisium_label: x.yudisium_label, yudisium_lulus: x.yudisium_lulus, aturan: x.aturan,
      locked_at: x.locked_at, email_status: x.email_status, email_detail: x.email_detail,
    })),
    bimbinganTerbaru(
      pra.data ?? [],
      (nb.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as Peran, nilai: Number(x.nilai) })),
      sidang,
    ),
    (kode) => nama.get(kode) ?? kode,
  )
}
