/** Berita Acara Prasidang (S1): two prasidang dosen, three fixed verdicts. Values match the DB checks. */
export type Hasil = 'layak' | 'layak_revisi' | 'tidak_layak'
export type StatusPrasidang = Hasil | 'belum_lengkap' | 'tidak_ada'
export type PeranPrasidang = 'pendamping' | 'pembahas'

export const HASIL: Hasil[] = ['layak', 'layak_revisi', 'tidak_layak']
export const HASIL_LABEL: Record<Hasil, string> = {
  layak: 'Skripsi layak untuk dilanjutkan',
  layak_revisi: 'Skripsi layak untuk dilanjutkan dengan revisi',
  tidak_layak: 'Skripsi tidak layak untuk dilanjutkan',
}
export const STATUS_LABEL: Record<StatusPrasidang, string> = {
  ...HASIL_LABEL,
  belum_lengkap: 'Berita acara belum lengkap',
  tidak_ada: 'Belum prasidang',
}

/** Pendamping = defenses.pembimbing_kode, Pembahas = defenses.penguji_kode. */
export const PERAN_PRASIDANG: PeranPrasidang[] = ['pendamping', 'pembahas']
export const PERAN_PRASIDANG_LABEL: Record<PeranPrasidang, string> = {
  pendamping: 'Dosen Pembimbing Pendamping',
  pembahas: 'Dosen Pembahas',
}

/** Both dosen's verdicts combined; the worst one wins. Same rule as status_prasidang() in the DB. */
export function gabungHasil(a: Hasil | null, b: Hasil | null): StatusPrasidang {
  if (!a || !b) return 'belum_lengkap'
  return HASIL[Math.max(HASIL.indexOf(a), HASIL.indexOf(b))]
}

/** Whether a sidang may be scheduled for this verdict. */
export const lolosGerbang = (s: StatusPrasidang): boolean => s === 'layak' || s === 'layak_revisi'

export type Jawaban = { teks: string; ya: boolean; catatan: string }

export const PERTANYAAN_BERUBAH = 'Daftar pertanyaan berubah. Muat ulang halaman lalu isi kembali.'
const CATATAN_MAKS = 1000

/** The answers a form sent, against the current question list. Returns the snapshot to store. */
export function cekJawaban(pertanyaan: string[], tampil: unknown, ya: unknown, catatan: unknown): { error: string } | { jawaban: Jawaban[] } {
  const sama = Array.isArray(tampil) && tampil.length === pertanyaan.length && tampil.every((t, i) => t === pertanyaan[i])
  if (!sama) return { error: PERTANYAAN_BERUBAH }
  if (!Array.isArray(ya) || ya.length !== pertanyaan.length || !ya.every((v) => typeof v === 'boolean')) return { error: 'Jawab semua pertanyaan.' }
  if (!Array.isArray(catatan) || catatan.length !== pertanyaan.length || !catatan.every((c) => typeof c === 'string')) return { error: 'Jawab semua pertanyaan.' }
  const c = (catatan as string[]).map((x) => x.trim())
  if (c.some((x) => x.length > CATATAN_MAKS)) return { error: `Catatan maksimal ${CATATAN_MAKS} karakter.` }
  return { jawaban: pertanyaan.map((teks, i) => ({ teks, ya: ya[i] as boolean, catatan: c[i] })) }
}

export const beritaAcaraPath = (id: string): string => `/berita-acara-prasidang/${id}`
