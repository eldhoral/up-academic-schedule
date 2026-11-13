import type { SupabaseClient } from '@supabase/supabase-js'
import { todayJakarta } from './akses'
import { round2 } from './nilai'

export type Aspek = { label: string; bobot: number; sub: string[] }
export type BarisNilai = { min: number; huruf: string; mutu: number }
export type BarisPredikat = { min: number; max: number; predikat: string; butuhTepatWaktu: boolean }
export type Yudisium = { label: string; lulus: boolean }
export type Aturan = {
  aspekBimbingan: Aspek[]
  aspekSidang: Aspek[]
  pilihanYudisium: Yudisium[]
  tabelNilai: BarisNilai[]
  predikat: BarisPredikat[]
  sksSkripsi: number
  tanggalMulai: string
}

/**
 * Mirrors the migration seed. tanggalMulai falls back to today's Jakarta date, as the seed does:
 * earlier prasidang count as old. This constant is fixed at module load; loadAturan recomputes it per call.
 */
export const DEFAULT_ATURAN: Aturan = {
  aspekBimbingan: [
    { label: 'Proses Pengerjaan Skripsi', bobot: 30, sub: [
      'Kemampuan belajar dan bekerja independen (mandiri)',
      'Kemampuan membuat perencanaan dan menjalankan',
      'Kerja tim pembimbing dan mahasiswa',
      'Sikap dan perilaku saat proses bimbingan'] },
    { label: 'Pemahaman Penelitian', bobot: 30, sub: [
      'Kemampuan mendefinisikan masalah',
      'Pemahaman teori',
      'Ketepatan metode',
      'Kualitas hasil penelitian',
      'Ketepatan penarikan kesimpulan',
      'Aplikasi dan spesifikasi saran'] },
    { label: 'Kajian Pustaka', bobot: 20, sub: [
      'Relevansi',
      'Kemutakhiran (70% literatur 10 tahun terakhir)',
      'Penyusunan daftar pustaka',
      'Kedalaman dan keluasan pustaka pendukung'] },
    { label: 'Sistematika Penulisan', bobot: 20, sub: [
      'Bahasa dan tata tulis sesuai kaidah Bahasa Indonesia dan APA'] },
  ],
  aspekSidang: [
    { label: 'Permasalahan', bobot: 20, sub: [
      'Orisinalitas dan kemutakhiran topik',
      'Ketajaman perumusan masalah'] },
    { label: 'Kajian Pustaka', bobot: 15, sub: [
      'Relevansi',
      'Kemutakhiran (70% berasal dari literatur 10 tahun terakhir)',
      'Penyusunan daftar pustaka sesuai APA',
      'Kedalaman dan keluasan pustaka pendukung'] },
    { label: 'Metode Penelitian', bobot: 15, sub: [
      'Ketepatan metode yang digunakan',
      'Comprehensiveness dan kedetailan metode'] },
    { label: 'Hasil Penelitian yang Dicapai', bobot: 15, sub: [
      'Manfaat dan kontribusi',
      'Kesesuaian dengan tujuan',
      'Kualitas hasil penelitian'] },
    { label: 'Sistematika Penulisan', bobot: 10, sub: [
      'Bahasa dan tata tulis sesuai dengan kaidah Bahasa Indonesia dan APA',
      'Kesinambungan antar alinea dan bab'] },
    { label: 'Kesimpulan dan Saran', bobot: 15, sub: [
      'Ketepatan penarikan kesimpulan',
      'Aplikasi dan spesifikasi saran'] },
    { label: 'Presentasi', bobot: 10, sub: [
      'Nilai sikap',
      'Komunikasi',
      'Penguasaan isi skripsi',
      'Penguasaan materi lain yang relevan',
      'Argumentasi jawaban'] },
  ],
  pilihanYudisium: [
    { label: 'Lulus Tanpa Revisi', lulus: true },
    { label: 'Lulus Dengan Revisi', lulus: true },
    { label: 'Tidak Lulus', lulus: false },
  ],
  tabelNilai: [
    { min: 80, huruf: 'A', mutu: 4 },
    { min: 76, huruf: 'A-', mutu: 3.67 },
    { min: 72, huruf: 'B+', mutu: 3.33 },
    { min: 68, huruf: 'B', mutu: 3 },
    { min: 64, huruf: 'B-', mutu: 2.67 },
    { min: 60, huruf: 'C+', mutu: 2.33 },
    { min: 56, huruf: 'C', mutu: 2 },
    { min: 45, huruf: 'D', mutu: 1 },
    { min: 0, huruf: 'E', mutu: 0 },
  ],
  predikat: [
    { min: 2, max: 2.75, predikat: 'Memuaskan', butuhTepatWaktu: false },
    { min: 2.76, max: 3.5, predikat: 'Sangat Memuaskan', butuhTepatWaktu: false },
    { min: 3.51, max: 4, predikat: 'Dengan Pujian', butuhTepatWaktu: true },
  ],
  sksSkripsi: 6,
  tanggalMulai: todayJakarta(),
}

const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function validateAspek(a: Aspek[]): string | null {
  if (a.length < 1) return 'Minimal satu aspek'
  for (const r of a) {
    if (!r.label.trim()) return 'Nama aspek wajib diisi'
    if (!num(r.bobot) || r.bobot <= 0) return `Bobot "${r.label}" harus lebih dari 0`
  }
  const total = round2(a.reduce((s, r) => s + r.bobot, 0))
  return total === 100 ? null : `Total bobot harus 100 (sekarang ${total})`
}

export function validateTabelNilai(t: BarisNilai[]): string | null {
  if (!t.some((r) => r.min === 0)) return 'Harus ada satu baris dengan batas bawah 0'
  for (const r of t) {
    if (!num(r.min) || r.min < 0 || r.min > 100) return 'Batas bawah harus antara 0 dan 100'
    if (!r.huruf.trim()) return 'Huruf wajib diisi'
    if (!num(r.mutu) || r.mutu < 0 || r.mutu > 4) return 'Bobot mutu harus antara 0 dan 4'
  }
  if (new Set(t.map((r) => r.min)).size !== t.length) return 'Batas bawah tidak boleh kembar'
  if (new Set(t.map((r) => r.huruf)).size !== t.length) return 'Huruf tidak boleh kembar'
  return null
}

export function validatePredikat(p: BarisPredikat[]): string | null {
  if (p.length < 1) return 'Minimal satu predikat'
  for (const r of p) {
    if (!r.predikat.trim()) return 'Nama predikat wajib diisi'
    if (!num(r.min) || !num(r.max) || r.min < 0 || r.max > 4) return 'IPK harus antara 0 dan 4'
    if (r.min > r.max) return `IPK min "${r.predikat}" melebihi IPK max`
  }
  // Compare in whole hundredths so 2,75 vs 2,75 overlaps and 2,75 vs 2,76 does not.
  const s = [...p].sort((x, y) => x.min - y.min)
  for (let i = 1; i < s.length; i++) {
    if (Math.round(s[i].min * 100) <= Math.round(s[i - 1].max * 100)) return 'Rentang IPK tidak boleh tumpang tindih'
  }
  return null
}

export function validatePilihanYudisium(p: Yudisium[]): string | null {
  for (const r of p) if (!r.label.trim()) return 'Nama yudisium wajib diisi'
  if (!p.some((r) => r.lulus)) return 'Minimal satu pilihan yang lulus'
  if (!p.some((r) => !r.lulus)) return 'Minimal satu pilihan yang tidak lulus'
  if (new Set(p.map((r) => r.label.trim())).size !== p.length) return 'Nama yudisium tidak boleh kembar'
  return null
}

export function validateSks(n: number): string | null {
  return Number.isInteger(n) && n > 0 ? null : 'SKS skripsi harus bilangan bulat lebih dari 0'
}

export function validateTanggal(v: string): string | null {
  return parseTanggal(v) ? null : 'Tanggal tidak valid'
}

// ---- parsing stored jsonb: wrong shape or failed validation -> null (caller falls back to the default)
const arr = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null)
const str = (v: unknown): v is string => typeof v === 'string'

function parseAspek(v: unknown): Aspek[] | null {
  if (!arr(v) || !v.every((r) => str(r.label) && num(r.bobot) && Array.isArray(r.sub) && r.sub.every(str))) return null
  const a = v.map((r) => ({ label: r.label as string, bobot: r.bobot as number, sub: r.sub as string[] }))
  return validateAspek(a) ? null : a
}

function parseTabel(v: unknown): BarisNilai[] | null {
  if (!arr(v) || !v.every((r) => num(r.min) && str(r.huruf) && num(r.mutu))) return null
  const t = v.map((r) => ({ min: r.min as number, huruf: r.huruf as string, mutu: r.mutu as number }))
  return validateTabelNilai(t) ? null : t.sort((x, y) => y.min - x.min)
}

function parsePredikat(v: unknown): BarisPredikat[] | null {
  if (!arr(v) || !v.every((r) => num(r.min) && num(r.max) && str(r.predikat) && typeof r.butuhTepatWaktu === 'boolean')) return null
  const p = v.map((r) => ({
    min: r.min as number, max: r.max as number, predikat: r.predikat as string, butuhTepatWaktu: r.butuhTepatWaktu as boolean,
  }))
  return validatePredikat(p) ? null : p.sort((x, y) => x.min - y.min)
}

function parsePilihan(v: unknown): Yudisium[] | null {
  if (!arr(v) || !v.every((r) => str(r.label) && typeof r.lulus === 'boolean')) return null
  const p = v.map((r) => ({ label: r.label as string, lulus: r.lulus as boolean }))
  return validatePilihanYudisium(p) ? null : p
}

/** The rules a locked sidang froze (hasil_sidang.aturan, built by the DB); null when the stored copy is unusable. */
export type AturanBeku = { tabelNilai: BarisNilai[]; predikat: BarisPredikat[]; sksSkripsi: number }

export const bekukan = (a: Aturan): AturanBeku => ({ tabelNilai: a.tabelNilai, predikat: a.predikat, sksSkripsi: a.sksSkripsi })

export function parseAturanBeku(json: unknown): AturanBeku | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null
  const j = json as Record<string, unknown>
  const tabelNilai = parseTabel(j.tabelNilai)
  const predikat = parsePredikat(j.predikat)
  if (!tabelNilai || !predikat || !num(j.sksSkripsi) || validateSks(j.sksSkripsi)) return null
  return { tabelNilai, predikat, sksSkripsi: j.sksSkripsi }
}

function parseTanggal(v: unknown): string | null {
  if (!str(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null
}

/** The prodi's rules; each missing or invalid kunci falls back to the default so a bad row never breaks grading. */
export async function loadAturan(db: SupabaseClient, prodi: 's1'): Promise<Aturan> {
  const { data, error } = await db.from('aturan_penilaian').select('kunci, nilai').eq('prodi', prodi)
  // A transient DB error must not fall back to defaults: that would freeze a default snapshot into an immutable grade.
  if (error) throw new Error(`Gagal memuat aturan penilaian: ${error.message}`)
  const raw = new Map<string, unknown>((data ?? []).map((r: { kunci: string; nilai: unknown }) => [r.kunci, r.nilai]))
  const sks = raw.get('sks_skripsi')
  return {
    aspekBimbingan: parseAspek(raw.get('aspek_bimbingan')) ?? DEFAULT_ATURAN.aspekBimbingan,
    aspekSidang: parseAspek(raw.get('aspek_sidang')) ?? DEFAULT_ATURAN.aspekSidang,
    pilihanYudisium: parsePilihan(raw.get('pilihan_yudisium')) ?? DEFAULT_ATURAN.pilihanYudisium,
    tabelNilai: parseTabel(raw.get('tabel_nilai')) ?? DEFAULT_ATURAN.tabelNilai,
    predikat: parsePredikat(raw.get('predikat')) ?? DEFAULT_ATURAN.predikat,
    sksSkripsi: num(sks) && !validateSks(sks) ? sks : DEFAULT_ATURAN.sksSkripsi,
    tanggalMulai: parseTanggal(raw.get('tanggal_mulai_penilaian')) ?? todayJakarta(),
  }
}
