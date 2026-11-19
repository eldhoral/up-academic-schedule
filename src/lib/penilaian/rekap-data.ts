import type { SupabaseClient } from '@supabase/supabase-js'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { Peran, PeranSidang } from './akses'
import { loadAturan, type Aturan } from './aturan'
import { bimbinganPerSidang, buildRekapAkhir, buildRekapBimbingan, type RekapAkhir, type RekapBimbingan } from './rekap'

export type TahunAkademik = { id: string; label: string }

/** Every tahun akademik (newest first) and the one asked for: `raw` if it exists, else the active one, else the newest. */
export async function pilihTahun(db: SupabaseClient, raw: string | null | undefined): Promise<{ years: TahunAkademik[]; ay: string }> {
  const { data, error } = await db.from('academic_years').select('id, label, is_active').order('id', { ascending: false })
  if (error) throw new Error(`Gagal memuat tahun akademik: ${error.message}`)
  const years = (data ?? []) as (TahunAkademik & { is_active: boolean })[]
  const ay = years.find((y) => y.id === raw)?.id ?? years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  return { years, ay }
}

/** The bimbingan recap of one tahun akademik: one row per S1 sidang. Session client: RLS (is_staff) decides who may read. Any DB error throws. */
export async function loadRekapBimbingan(db: SupabaseClient, ay: string): Promise<{ rows: RekapBimbingan[]; aturan: Aturan }> {
  const [d, s, l, aturan] = await Promise.all([
    db.from('defenses').select('id, tanggal, npm, nama_mahasiswa, judul_skripsi')
      .eq('prodi', 's1').eq('jenis', 'sidang').eq('academic_year_id', ay),
    db.from('students').select('npm, sks_sebelum, bobot_sebelum, pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2').eq('prodi', 's1'),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    loadAturan(db, 's1'),
  ])
  const err = d.error ?? s.error ?? l.error
  if (err) throw new Error(`Gagal memuat rekap nilai bimbingan: ${err.message}`)
  const sidang = d.data ?? []
  const ids = sidang.map((x) => x.id)

  const [n, h] = ids.length
    ? await Promise.all([
      db.from('nilai_bimbingan').select('defense_id, peran, nilai, sumber').in('defense_id', ids),
      db.from('hasil_sidang').select('defense_id, locked_at').in('defense_id', ids),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]
  const err2 = n.error ?? h.error
  if (err2) throw new Error(`Gagal memuat rekap nilai bimbingan: ${err2.message}`)

  const nama = new Map((l.data ?? []).map((x) => [x.kode_dosen as string, lecturerDisplayName(x)]))
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  const rows = buildRekapBimbingan(
    sidang,
    (s.data ?? []).map((x) => ({
      npm: x.npm, sks_sebelum: num(x.sks_sebelum), bobot_sebelum: num(x.bobot_sebelum),
      pembimbing_1_kode: x.pembimbing_1_kode, pembimbing_2_kode: x.pembimbing_2_kode, tanpa_pembimbing_2: !!x.tanpa_pembimbing_2,
    })),
    (n.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as Peran, nilai: Number(x.nilai), sumber: x.sumber as 'dosen' | 'manual' })),
    (h.data ?? []).map((x) => ({ defense_id: x.defense_id as string, locked_at: x.locked_at as string })),
    aturan.batasHariBimbingan,
    (kode) => nama.get(kode) ?? kode,
  )
  return { rows, aturan }
}

/**
 * The Nilai Akhir recap of one tahun akademik. Session client: RLS (is_staff) decides who may read. Any DB error throws.
 */
export async function loadRekapAkhir(db: SupabaseClient, ay: string): Promise<RekapAkhir[]> {
  const [d, s, l, n, h] = await Promise.all([
    db.from('defenses').select('id, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode, penguji_eksternal_kode')
      .eq('prodi', 's1').eq('jenis', 'sidang').eq('academic_year_id', ay),
    db.from('students').select('npm, sks_sebelum, bobot_sebelum, tepat_waktu, tanpa_pembimbing_2').eq('prodi', 's1'),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    db.from('nilai_sidang').select('defense_id, peran, nilai, defenses!inner(academic_year_id)').eq('defenses.academic_year_id', ay),
    db.from('hasil_sidang')
      .select('defense_id, yudisium_label, yudisium_lulus, aturan, locked_at, email_status, email_detail, defenses!inner(academic_year_id)')
      .eq('defenses.academic_year_id', ay),
  ])
  const err = d.error ?? s.error ?? l.error ?? n.error ?? h.error
  if (err) throw new Error(`Gagal memuat rekap nilai akhir: ${err.message}`)
  const sidang = d.data ?? []

  // Bimbingan is graded on the sidang itself.
  const nb = sidang.length
    ? await db.from('nilai_bimbingan').select('defense_id, peran, nilai').in('defense_id', sidang.map((x) => x.id))
    : { data: [], error: null }
  if (nb.error) throw new Error(`Gagal memuat rekap nilai akhir: ${nb.error.message}`)

  const nama = new Map((l.data ?? []).map((x) => [x.kode_dosen as string, lecturerDisplayName(x)]))
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  const tanpaNpm = new Set((s.data ?? []).filter((x) => x.tanpa_pembimbing_2).map((x) => x.npm as string))
  const tanpaP2 = new Set(sidang.filter((x) => tanpaNpm.has(x.npm)).map((x) => x.id as string))
  return buildRekapAkhir(
    sidang,
    (s.data ?? []).map((x) => ({ npm: x.npm, sks_sebelum: num(x.sks_sebelum), bobot_sebelum: num(x.bobot_sebelum), tepat_waktu: !!x.tepat_waktu })),
    (n.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as PeranSidang, nilai: Number(x.nilai) })),
    (h.data ?? []).map((x) => ({
      defense_id: x.defense_id, yudisium_label: x.yudisium_label, yudisium_lulus: x.yudisium_lulus, aturan: x.aturan,
      locked_at: x.locked_at, email_status: x.email_status, email_detail: x.email_detail,
    })),
    bimbinganPerSidang((nb.data ?? []).map((x) => ({ defense_id: x.defense_id, peran: x.peran as Peran, nilai: Number(x.nilai) })), tanpaP2),
    (kode) => nama.get(kode) ?? kode,
  )
}
