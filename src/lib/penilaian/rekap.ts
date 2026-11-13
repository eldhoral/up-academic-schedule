import { ANGGOTA_I_LEGACY, PERAN_SIDANG, type Peran, type PeranSidang } from './akses'
import { parseAturanBeku } from './aturan'
import { baris, hasilAkhir, ipkSebelum, nilaiBimbingan, nilaiSidang, type HasilAkhir } from './nilai'

export type DosenNilai = { nama: string; nilai: number | null; manual: boolean }
export type RekapBimbingan = {
  defenseId: string
  tanggal: string
  npm: string
  nama: string
  judul: string
  ipk: number | null
  dospem1: DosenNilai
  dospem2: DosenNilai
  bimbingan: number | null
}

type DefenseIn = {
  id: string
  tanggal: string
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  pembimbing_kode: string | null
  penguji_kode: string | null
}
type StudentIn = { npm: string; sks_sebelum: number | null; bobot_sebelum: number | null }
type NilaiIn = { defense_id: string; peran: Peran; nilai: number; sumber: 'dosen' | 'manual' }

/** One row per S1 prasidang, by tanggal then nama. Pure: the page and the Excel file are both built from it. */
export function buildRekapBimbingan(
  defenses: DefenseIn[],
  students: StudentIn[],
  nilai: NilaiIn[],
  namaDosen: (kode: string) => string,
): RekapBimbingan[] {
  const mhs = new Map(students.map((s) => [s.npm, s]))
  const skor = new Map(nilai.map((n) => [`${n.defense_id}/${n.peran}`, n]))
  return defenses
    .map((d): RekapBimbingan => {
      const dosen = (kode: string | null, peran: Peran): DosenNilai => {
        const n = skor.get(`${d.id}/${peran}`)
        return { nama: kode ? namaDosen(kode) : '—', nilai: n?.nilai ?? null, manual: n?.sumber === 'manual' }
      }
      const s = mhs.get(d.npm)
      const dospem1 = dosen(d.pembimbing_kode, 'pembimbing_1')
      const dospem2 = dosen(d.penguji_kode, 'pembimbing_2')
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        ipk: ipkSebelum(s?.bobot_sebelum ?? null, s?.sks_sebelum ?? null),
        dospem1,
        dospem2,
        bimbingan: nilaiBimbingan(dospem1.nilai, dospem2.nilai),
      }
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama))
}

// ---- Nilai Akhir (S1 sidang)

export type RekapAkhir = {
  defenseId: string
  tanggal: string
  npm: string
  nama: string
  judul: string
  bimbingan: number | null
  penguji: Record<PeranSidang, { nama: string; nilai: number | null }>
  hasil: HasilAkhir
  yudisium: string | null
  emailStatus: string | null
  /** Per-address outcome of the revisi mail; [] when none is stored. */
  emailDetail: DetailEmail[]
  // Beyond the brief: shown by the page and the file, all derived from the same inputs.
  ipkSebelum: number | null
  /** Letter of Nilai Sidang from the frozen Tabel Nilai; null until locked (or when the frozen copy is unreadable). */
  hurufSidang: string | null
  lockedAt: string | null
}

type SidangIn = DefenseIn & { penguji_eksternal_kode: string | null }
type StudentAkhirIn = StudentIn & { tepat_waktu: boolean }
type NilaiSidangIn = { defense_id: string; peran: PeranSidang; nilai: number }
type HasilIn = {
  defense_id: string
  yudisium_label: string
  yudisium_lulus: boolean
  aturan: unknown
  locked_at: string
  email_status: string | null
  email_detail: unknown
}

export type DetailEmail = { alamat: string; status: 'terkirim' | 'gagal' | 'dilewati'; alasan?: string }

/** hasil_sidang.email_detail is jsonb: keep the well-formed entries, never throw. */
export function parseDetailEmail(json: unknown): DetailEmail[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((x): DetailEmail[] => {
    if (typeof x !== 'object' || x === null) return []
    const { alamat, status, alasan } = x as Record<string, unknown>
    if (typeof alamat !== 'string' || !['terkirim', 'gagal', 'dilewati'].includes(status as string)) return []
    return [{ alamat, status: status as DetailEmail['status'], ...(typeof alasan === 'string' ? { alasan } : {}) }]
  })
}

/** Shown for a locked sidang whose frozen rules cannot be read: by the recap and by the grading page alike. */
export const ALASAN_ATURAN_RUSAK = 'Aturan penilaian yang dibekukan tidak terbaca'

export const EMAIL_LABEL: Record<string, string> = {
  tidak_perlu: 'Tidak perlu', menunggu: 'Menunggu', terkirim: 'Terkirim', gagal: 'Gagal', sebagian: 'Sebagian',
}

/** A retry is for gagal/sebagian; 'menunggu' only once it is clearly stuck, so a send still in flight is not doubled. */
export function bolehKirimUlang(status: string | null, lockedAt: string | null, now: Date = new Date()): boolean {
  if (status === 'gagal' || status === 'sebagian') return true
  const t = lockedAt ? Date.parse(lockedAt) : NaN
  return status === 'menunggu' && now.getTime() - t > 2 * 60_000
}

/**
 * Sidang id -> Nilai Bimbingan of that NPM's LATEST prasidang dated on or before the sidang (any year); null while that one
 * is incomplete. Older ones never fill in, and a prasidang retaken after the sidang never changes a locked Nilai Akhir.
 */
export function bimbinganTerbaru(
  prasidang: { id: string; tanggal: string; npm: string }[],
  nilai: { defense_id: string; peran: Peran; nilai: number }[],
  sidang: { id: string; tanggal: string; npm: string }[],
): Map<string, number | null> {
  const skor = (id: string, peran: Peran) => nilai.find((n) => n.defense_id === id && n.peran === peran)?.nilai ?? null
  const hasil = new Map<string, number | null>()
  for (const s of sidang) {
    let terbaru: { id: string; tanggal: string } | undefined
    for (const p of prasidang) {
      if (p.npm !== s.npm || p.tanggal > s.tanggal) continue
      if (!terbaru || p.tanggal > terbaru.tanggal || (p.tanggal === terbaru.tanggal && p.id > terbaru.id)) terbaru = p
    }
    if (terbaru) hasil.set(s.id, nilaiBimbingan(skor(terbaru.id, 'pembimbing_1'), skor(terbaru.id, 'pembimbing_2')))
  }
  return hasil
}

/** One row per S1 sidang, by tanggal then nama. Pure: the page and the Excel file are both built from it. */
export function buildRekapAkhir(
  sidang: SidangIn[],
  students: StudentAkhirIn[],
  nilai: NilaiSidangIn[],
  hasil: HasilIn[],
  bimbinganBySidang: Map<string, number | null>,
  namaDosen: (kode: string) => string,
): RekapAkhir[] {
  const mhs = new Map(students.map((s) => [s.npm, s]))
  const skor = new Map(nilai.map((n) => [`${n.defense_id}/${n.peran}`, n.nilai]))
  const kunci = new Map(hasil.map((h) => [h.defense_id, h]))
  return sidang
    .map((d): RekapAkhir => {
      const kode: Record<PeranSidang, string | null> = { ketua: d.penguji_kode, anggota_1: d.penguji_eksternal_kode, anggota_2: d.pembimbing_kode }
      const nama = (p: PeranSidang) => (kode[p] ? namaDosen(kode[p]!) : p === 'anggota_1' ? ANGGOTA_I_LEGACY : '—')
      const penguji = Object.fromEntries(
        PERAN_SIDANG.map((p) => [p, { nama: nama(p), nilai: skor.get(`${d.id}/${p}`) ?? null }]),
      ) as RekapAkhir['penguji']
      const nilaiTiga = PERAN_SIDANG.map((p) => penguji[p].nilai)
      const s = mhs.get(d.npm)
      const bimbingan = bimbinganBySidang.get(d.id) ?? null
      const h = kunci.get(d.id)
      const aturan = h ? parseAturanBeku(h.aturan) : null
      const input = {
        sidang: nilaiTiga, bimbingan, sks: s?.sks_sebelum ?? null, bobot: s?.bobot_sebelum ?? null, tepatWaktu: s?.tepat_waktu ?? false,
      }
      const ns = nilaiSidang(nilaiTiga)
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        bimbingan,
        penguji,
        // Locked but the frozen copy is unreadable: say so, never compute from guesses.
        hasil: h && !aturan
          ? { status: 'data-kurang', nilaiSidang: ns, alasan: ALASAN_ATURAN_RUSAK }
          : hasilAkhir({ ...input, locked: h && aturan ? { lulus: h.yudisium_lulus, aturan } : null }),
        yudisium: h?.yudisium_label ?? null,
        emailStatus: h?.email_status ?? null,
        emailDetail: parseDetailEmail(h?.email_detail),
        ipkSebelum: ipkSebelum(s?.bobot_sebelum ?? null, s?.sks_sebelum ?? null),
        hurufSidang: ns !== null && aturan ? baris(ns, aturan.tabelNilai).huruf : null,
        lockedAt: h?.locked_at ?? null,
      }
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama))
}
