import { ANGGOTA_I_LEGACY, PERAN_SIDANG, PERAN_SIDANG_LABEL, type Peran, type PeranSidang } from './akses'
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
  /** The student has no Dosen Pembimbing II: Nilai Bimbingan is Pembimbing I's grade. */
  tanpaP2: boolean
  bimbingan: number | null
  /** Last day the Dosen Pembimbing may grade; null until the Ketua locks the sidang. */
  batas: string | null
}

type DefenseIn = {
  id: string
  tanggal: string
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
}
type StudentIn = { npm: string; sks_sebelum: number | null; bobot_sebelum: number | null }
type StudentPembimbingIn = StudentIn & { pembimbing_1_kode: string | null; pembimbing_2_kode: string | null; tanpa_pembimbing_2: boolean }
type NilaiIn = { defense_id: string; peran: Peran; nilai: number; sumber: 'dosen' | 'manual' }

/**
 * One row per S1 sidang, in the order given (the SQL query sorts them). The dosen are the student's Pembimbing I/II (Data Mahasiswa).
 * Pure: the page and the Excel file are both built from it.
 */
export function buildRekapBimbingan(
  sidang: DefenseIn[],
  students: StudentPembimbingIn[],
  nilai: NilaiIn[],
  kunci: { defense_id: string; locked_at: string }[],
  /** The prodi's pengisian range: a locked sidang's batas is its last day. */
  periode: { mulai: string; selesai: string },
  namaDosen: (kode: string) => string,
): RekapBimbingan[] {
  const mhs = new Map(students.map((s) => [s.npm, s]))
  const skor = new Map(nilai.map((n) => [`${n.defense_id}/${n.peran}`, n]))
  const locked = new Map(kunci.map((k) => [k.defense_id, k.locked_at]))
  return sidang
    .map((d): RekapBimbingan => {
      const s = mhs.get(d.npm)
      const dosen = (kode: string | null | undefined, peran: Peran): DosenNilai => {
        const n = skor.get(`${d.id}/${peran}`)
        return { nama: kode ? namaDosen(kode) : '—', nilai: n?.nilai ?? null, manual: n?.sumber === 'manual' }
      }
      const dospem1 = dosen(s?.pembimbing_1_kode, 'pembimbing_1')
      const tanpaP2 = !!s?.tanpa_pembimbing_2
      const dospem2 = tanpaP2 ? { nama: 'Tidak ada', nilai: null, manual: false } : dosen(s?.pembimbing_2_kode, 'pembimbing_2')
      const lockedAt = locked.get(d.id)
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        ipk: ipkSebelum(s?.bobot_sebelum ?? null, s?.sks_sebelum ?? null),
        dospem1,
        dospem2,
        tanpaP2,
        bimbingan: nilaiBimbingan(dospem1.nilai, dospem2.nilai, tanpaP2),
        batas: lockedAt ? periode.selesai : null,
      }
    })
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

type SidangIn = DefenseIn & { pembimbing_kode: string | null; penguji_kode: string | null; penguji_eksternal_kode: string | null }
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
 * Sidang id -> Nilai Bimbingan graded on that sidang; null while only one Pembimbing has graded.
 * tanpaP2: the sidang whose student has no Pembimbing II (Pembimbing I's grade alone).
 */
export function bimbinganPerSidang(
  nilai: { defense_id: string; peran: Peran; nilai: number }[],
  tanpaP2: ReadonlySet<string> = new Set(),
): Map<string, number | null> {
  const per = new Map<string, Partial<Record<Peran, number>>>()
  for (const n of nilai) per.set(n.defense_id, { ...per.get(n.defense_id), [n.peran]: n.nilai })
  return new Map([...per].map(([id, p]) => [id, nilaiBimbingan(p.pembimbing_1 ?? null, p.pembimbing_2 ?? null, tanpaP2.has(id))]))
}

/** One row per S1 sidang, in the order given (the SQL query sorts them). Pure: the page and the Excel file are both built from it. */
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
}

/**
 * The Nilai Sidang recap's progress label. A sidang not yet held and with nothing graded is "Belum dibuka";
 * once anything is graded (Super Admin may enter early) the missing examiners are named.
 */
export function statusNilaiSidang(
  r: Pick<RekapAkhir, 'tanggal' | 'penguji' | 'yudisium' | 'lockedAt'>,
  today: string,
): string {
  if (r.lockedAt) return `Terkunci · ${r.yudisium ?? ''}`.trim()
  const kurang = (['anggota_1', 'anggota_2'] as const).filter((p) => r.penguji[p].nilai === null)
  if (today < r.tanggal && kurang.length === 2 && r.penguji.ketua.nilai === null) return 'Belum dibuka'
  if (kurang.length) return `Menunggu ${kurang.map((p) => PERAN_SIDANG_LABEL[p]).join(' dan ')}`
  return 'Menunggu Ketua'
}
