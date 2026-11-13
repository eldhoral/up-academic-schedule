import type { SupabaseClient } from '@supabase/supabase-js'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { Peran } from './akses'
import { loadAturan, type Aturan } from './aturan'
import { buildRekapBimbingan, type RekapBimbingan } from './rekap'

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
