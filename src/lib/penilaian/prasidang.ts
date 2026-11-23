import type { JenisPertanyaan, Pertanyaan } from './aturan'
/** Berita Acara Prasidang (S1): filled by the Pembimbing Pendamping alone, three fixed verdicts. Values match the DB checks. */
export type Hasil = 'layak' | 'layak_revisi' | 'tidak_layak'
export type StatusPrasidang = Hasil | 'belum_lengkap' | 'tidak_ada'
// 'pembahas' stays only for rows filled before 2026-11-23; it no longer counts or can be filled.
export type PeranPrasidang = 'pendamping' | 'pembahas'

export const HASIL: Hasil[] = ['layak', 'layak_revisi', 'tidak_layak']
export const HASIL_LABEL: Record<Hasil, string> = {
  layak: 'Skripsi layak untuk dilanjutkan',
  layak_revisi: 'Skripsi layak untuk dilanjutkan dengan revisi',
  tidak_layak: 'Skripsi tidak layak untuk dilanjutkan (Mahasiswa diharapkan mengganti topik atau variabel penelitian)',
}
export const STATUS_LABEL: Record<StatusPrasidang, string> = {
  ...HASIL_LABEL,
  belum_lengkap: 'Berita acara belum lengkap',
  tidak_ada: 'Belum prasidang',
}

/** Who fills the berita acara: Pendamping = defenses.pembimbing_kode. (Pembahas = penguji_kode only attends.) */
export const PERAN_PRASIDANG: PeranPrasidang[] = ['pendamping']
export const PERAN_PRASIDANG_LABEL: Record<PeranPrasidang, string> = {
  pendamping: 'Dosen Pembimbing Pendamping',
  pembahas: 'Dosen Pembahas',
}

/** Whether a sidang may be scheduled for this verdict. */
export const lolosGerbang = (s: StatusPrasidang): boolean => s === 'layak' || s === 'layak_revisi'

/** One answered question. ya is null for an uraian, whose answer is catatan. */
export type Jawaban = { teks: string; jenis: JenisPertanyaan; ya: boolean | null; catatan: string }

export const SUDAH_DIKIRIM_BA = 'Berita acara sudah dikirim.'
export const PERTANYAAN_BERUBAH = 'Daftar pertanyaan berubah. Muat ulang halaman lalu isi kembali.'
export const MAKS_CATATAN = 1000
export const MAKS_URAIAN = 2000

/** The answers a form sent, against the current question list (text and kind). Returns the snapshot to store. */
export function cekJawaban(pertanyaan: Pertanyaan[], tampil: unknown, ya: unknown, catatan: unknown): { error: string } | { jawaban: Jawaban[] } {
  const n = pertanyaan.length
  const sama = Array.isArray(tampil) && tampil.length === n &&
    tampil.every((t, i) => typeof t === 'object' && t !== null && t.teks === pertanyaan[i].teks && t.jenis === pertanyaan[i].jenis)
  if (!sama) return { error: PERTANYAAN_BERUBAH }
  if (!Array.isArray(ya) || ya.length !== n || !Array.isArray(catatan) || catatan.length !== n || !catatan.every((c) => typeof c === 'string')) {
    return { error: 'Jawab semua pertanyaan.' }
  }
  const jawaban: Jawaban[] = []
  for (let i = 0; i < n; i++) {
    const { teks, jenis } = pertanyaan[i]
    const c = (catatan[i] as string).trim()
    if (jenis === 'uraian') {
      if (!c) return { error: `"${teks}" wajib diisi.` }
      if (c.length > MAKS_URAIAN) return { error: `"${teks}" maksimal ${MAKS_URAIAN} karakter.` }
      jawaban.push({ teks, jenis, ya: null, catatan: c })
    } else {
      if (typeof ya[i] !== 'boolean') return { error: 'Jawab semua pertanyaan.' }
      if (c.length > MAKS_CATATAN) return { error: `Catatan maksimal ${MAKS_CATATAN} karakter.` }
      jawaban.push({ teks, jenis, ya: ya[i] as boolean, catatan: c })
    }
  }
  return { jawaban }
}

/** The faculty asks for the berita acara by the day after the prasidang. Shown only, never enforced (user decision). */
export function batasBeritaAcara(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export const beritaAcaraPath = (id: string): string => `/berita-acara-prasidang/${id}`

/** The sidang gate's messages, word for word as the DB trigger raises them (gerbang_sidang). */
export const PESAN_GERBANG = {
  tidak_ada: 'Mahasiswa belum memiliki prasidang. Super Admin dapat memberi keputusan di Data Mahasiswa.',
  belum_lengkap: 'Berita acara prasidang belum lengkap.',
  tidak_layak: 'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.',
  pembimbing: 'Dosen Pembimbing mahasiswa belum lengkap di Data Mahasiswa.',
} as const
