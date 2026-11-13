export type Peran = 'pembimbing_1' | 'pembimbing_2'
export type DefenseRef = {
  id: string
  prodi: string
  jenis: string
  tanggal: string
  pembimbing_kode: string | null
  penguji_kode: string | null
}
export type AksesDosen =
  | { kind: 'tidak-ada' }
  | { kind: 'belum-dibuka'; tanggal: string }
  | { kind: 'isi'; peran: Peran }
  | { kind: 'terkirim'; peran: Peran }

/** Today in Asia/Jakarta as YYYY-MM-DD (en-CA formats as ISO). */
export const todayJakarta = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)

/** Only S1 prasidang is graded online. */
export const bisaDinilai = (s: { prodi: string; jenis: string }): boolean => s.prodi === 's1' && s.jenis === 'prasidang'

export function peranDosen(d: DefenseRef, kode: string): Peran | null {
  if (!bisaDinilai(d)) return null
  if (d.pembimbing_kode === kode) return 'pembimbing_1'
  if (d.penguji_kode === kode) return 'pembimbing_2'
  return null
}

/** Rules 2-5 of the spec (submitted wins over the date gate). 'tidak-ada' means 404 with no hint the record exists. */
export function aksesDosen(d: DefenseRef | null, kode: string, submitted: Set<Peran>, today: string): AksesDosen {
  const peran = d && peranDosen(d, kode)
  if (!d || !peran) return { kind: 'tidak-ada' }
  // Submitted first: tanggal can still move after grading, and the grade must stay visible.
  if (submitted.has(peran)) return { kind: 'terkirim', peran }
  if (today < d.tanggal) return { kind: 'belum-dibuka', tanggal: d.tanggal }
  return { kind: 'isi', peran }
}

/** Old prasidang (before the start date) get manual entry by Super Admin. */
export const bolehInputLama = (d: DefenseRef, tanggalMulai: string): boolean => bisaDinilai(d) && d.tanggal < tanggalMulai

export const penilaianPath = (id: string): string => `/nilai-bimbingan/${id}`

export const PERAN_LABEL: Record<Peran, string> = { pembimbing_1: 'Dosen Pembimbing I', pembimbing_2: 'Dosen Pembimbing II' }

/**
 * The only app pages a DOSEN account may open (plus /masuk, /auth and the public /jadwal-dosen). Everything else sends it to Penilaian Saya.
 * An EKSTERNAL gets less: no bimbingan, and no password page (its password is set by the admin).
 */
export const halamanDosen = (path: string, role: string = 'DOSEN'): boolean =>
  path === '/penilaian' ||
  /^\/nilai-sidang\/[^/]+$/.test(path) ||
  (role !== 'EKSTERNAL' && (path === '/atur-kata-sandi' || /^\/nilai-bimbingan\/[^/]+$/.test(path)))

// ---- Sidang Skripsi (S1): Ketua = penguji_kode, Anggota I = penguji_eksternal_kode, Anggota II = pembimbing_kode.
export type PeranSidang = 'ketua' | 'anggota_1' | 'anggota_2'
export type SidangRef = DefenseRef & { penguji_eksternal_kode: string | null }
export type AksesSidang =
  | { kind: 'tidak-ada' }
  | { kind: 'belum-dibuka'; tanggal: string }
  | { kind: 'isi'; peran: PeranSidang }
  | { kind: 'menunggu-anggota'; kurang: PeranSidang[] }
  | { kind: 'kunci'; peran: PeranSidang }
  | { kind: 'terkirim'; peran: PeranSidang }
  | { kind: 'terkunci' }

export const bisaDinilaiSidang = (s: { prodi: string; jenis: string }): boolean => s.prodi === 's1' && s.jenis === 'sidang'

export function peranPenguji(d: SidangRef, kode: string): PeranSidang | null {
  if (!bisaDinilaiSidang(d) || !kode) return null
  if (d.penguji_kode === kode) return 'ketua'
  if (d.penguji_eksternal_kode === kode) return 'anggota_1'
  if (d.pembimbing_kode === kode) return 'anggota_2'
  return null
}

/**
 * Sidang access rules. akunTanggal is the day an EKSTERNAL account was made for; a defense moved off that day is 404 to it.
 * Locked and submitted states come before the date gate, so a rescheduled graded sidang stays read-only.
 */
export function aksesSidang(
  d: SidangRef | null,
  kode: string,
  opts: { submitted: Set<PeranSidang>; locked: boolean; today: string; akunTanggal?: string },
): AksesSidang {
  const peran = d && peranPenguji(d, kode)
  if (!d || !peran) return { kind: 'tidak-ada' }
  if (opts.akunTanggal !== undefined && opts.akunTanggal !== d.tanggal) return { kind: 'tidak-ada' }
  if (opts.locked) return { kind: 'terkunci' }
  if (opts.submitted.has(peran)) return { kind: 'terkirim', peran }
  if (opts.today < d.tanggal) return { kind: 'belum-dibuka', tanggal: d.tanggal }
  if (peran !== 'ketua') return { kind: 'isi', peran }
  const kurang = (['anggota_1', 'anggota_2'] as const).filter((a) => !opts.submitted.has(a))
  return kurang.length ? { kind: 'menunggu-anggota', kurang } : { kind: 'kunci', peran }
}

/** An EKSTERNAL login works through berlaku_sampai (inclusive), by the Jakarta date. */
export const eksternalAktif = (berlakuSampai: string, now: Date = new Date()): boolean => todayJakarta(now) <= berlakuSampai

export const penilaianSidangPath = (id: string): string => `/nilai-sidang/${id}`

/** Old sidang (before the start date): Super Admin enters missing grades and locks for the Ketua. */
export const bolehInputLamaSidang = (d: SidangRef, tanggalMulai: string): boolean => bisaDinilaiSidang(d) && d.tanggal < tanggalMulai

export const PERAN_SIDANG: PeranSidang[] = ['ketua', 'anggota_1', 'anggota_2']

/** Labels from SIDANG_PERAN_LABEL (jadwal-dosen/events.ts). */
export const PERAN_SIDANG_LABEL: Record<PeranSidang, string> = {
  ketua: 'Ketua Sidang',
  anggota_1: 'Anggota Penguji I',
  anggota_2: 'Anggota Penguji II',
}

/** Penilaian Saya status of a sidang row; the Ketua's lock form counts as not yet graded. */
export const STATUS_SIDANG: Record<Exclude<AksesSidang['kind'], 'tidak-ada'>, string> = {
  'belum-dibuka': 'Belum dibuka',
  isi: 'Belum dinilai',
  kunci: 'Belum dinilai',
  'menunggu-anggota': 'Menunggu anggota',
  terkirim: 'Terkirim',
  terkunci: 'Terkunci',
}

/** A legacy free-text Anggota Penguji I (no kode) can't grade, so the sidang can't be locked. */
export const ANGGOTA_I_LEGACY = 'Anggota Penguji I belum dipilih dari data dosen'
