import type { PeranPrasidang } from './prasidang'

export type Peran = 'pembimbing_1' | 'pembimbing_2'
export type DefenseRef = {
  id: string
  prodi: string
  jenis: string
  tanggal: string
  pembimbing_kode: string | null
  penguji_kode: string | null
}
/** Today in Asia/Jakarta as YYYY-MM-DD (en-CA formats as ISO). */
export const todayJakarta = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now)

// ---- Berita Acara Prasidang (S1): Pendamping = pembimbing_kode, Pembahas = penguji_kode.
export type AksesBeritaAcara =
  | { kind: 'tidak-ada' }
  | { kind: 'belum-dibuka'; tanggal: string }
  | { kind: 'isi'; peran: PeranPrasidang }
  | { kind: 'terkirim'; peran: PeranPrasidang }

export const isPrasidangS1 = (s: { prodi: string; jenis: string }): boolean => s.prodi === 's1' && s.jenis === 'prasidang'

export function peranPrasidang(d: DefenseRef, kode: string): PeranPrasidang | null {
  if (!isPrasidangS1(d) || !kode) return null
  if (d.pembimbing_kode === kode) return 'pendamping'
  if (d.penguji_kode === kode) return 'pembahas'
  return null
}

/** 'tidak-ada' means 404 with no hint the record exists. Submitted wins over the date gate (a rescheduled prasidang). */
export function aksesBeritaAcara(d: DefenseRef | null, kode: string, submitted: Set<PeranPrasidang>, today: string): AksesBeritaAcara {
  const peran = d && peranPrasidang(d, kode)
  if (!d || !peran) return { kind: 'tidak-ada' }
  if (submitted.has(peran)) return { kind: 'terkirim', peran }
  if (today < d.tanggal) return { kind: 'belum-dibuka', tanggal: d.tanggal }
  return { kind: 'isi', peran }
}

// ---- Nilai Bimbingan (S1): on the sidang, by the student's Pembimbing I/II, after the Ketua's lulus lock, for n days.
export type BimbinganRef = { id: string; prodi: string; jenis: string; pembimbing_1_kode: string | null; pembimbing_2_kode: string | null }
export type AksesBimbingan =
  | { kind: 'tidak-ada' }
  | { kind: 'terkirim'; peran: Peran }
  | { kind: 'menunggu-kunci' }
  | { kind: 'tidak-lulus' }
  | { kind: 'lewat'; batas: string }
  | { kind: 'isi'; peran: Peran; batas: string }

export function peranBimbingan(d: BimbinganRef, kode: string): Peran | null {
  if (!bisaDinilaiSidang(d) || !kode) return null
  if (d.pembimbing_1_kode === kode) return 'pembimbing_1'
  if (d.pembimbing_2_kode === kode) return 'pembimbing_2'
  return null
}

/** The last grading day: the lock's Jakarta date (day 0) plus n days. */
export function batasBimbingan(lockedAt: string, n: number): string {
  const d = new Date(`${todayJakarta(new Date(lockedAt))}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Spec rules 1-6, in order. Submitted first: a grade stays visible whatever happens to the lock or the window. */
export function aksesBimbingan(
  d: BimbinganRef | null,
  kode: string,
  o: { submitted: Set<Peran>; kunci: { lockedAt: string; lulus: boolean } | null; today: string; batasHari: number },
): AksesBimbingan {
  const peran = d && peranBimbingan(d, kode)
  if (!d || !peran) return { kind: 'tidak-ada' }
  if (o.submitted.has(peran)) return { kind: 'terkirim', peran }
  if (!o.kunci) return { kind: 'menunggu-kunci' }
  if (!o.kunci.lulus) return { kind: 'tidak-lulus' }
  const batas = batasBimbingan(o.kunci.lockedAt, o.batasHari)
  return o.today > batas ? { kind: 'lewat', batas } : { kind: 'isi', peran, batas }
}

export const penilaianPath = (id: string): string => `/nilai-bimbingan/${id}`

export const PERAN_LABEL: Record<Peran, string> = { pembimbing_1: 'Dosen Pembimbing I', pembimbing_2: 'Dosen Pembimbing II' }

/**
 * The only app pages a DOSEN account may open (plus /masuk, /auth and the public /jadwal-dosen). Everything else sends it to Penilaian Saya.
 * An EKSTERNAL gets less: no bimbingan, and no password page (its password is set by the admin).
 */
export const halamanDosen = (path: string, role: string = 'DOSEN'): boolean =>
  path === '/penilaian' ||
  /^\/nilai-sidang\/[^/]+$/.test(path) ||
  (role !== 'EKSTERNAL' &&
    (path === '/atur-kata-sandi' || /^\/nilai-bimbingan\/[^/]+$/.test(path) || /^\/berita-acara-prasidang\/[^/]+$/.test(path)))

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
  if (opts.submitted.has(peran)) {
    if (peran !== 'ketua') return { kind: 'terkirim', peran }
    // The Ketua has sent its own grade: it locks once both anggota have sent theirs.
    const kurang = (['anggota_1', 'anggota_2'] as const).filter((a) => !opts.submitted.has(a))
    return kurang.length ? { kind: 'menunggu-anggota', kurang } : { kind: 'kunci', peran }
  }
  if (opts.today < d.tanggal) return { kind: 'belum-dibuka', tanggal: d.tanggal }
  // Every examiner, the Ketua included, grades from the date in any order.
  return { kind: 'isi', peran }
}

/** An EKSTERNAL login works through berlaku_sampai (inclusive), by the Jakarta date. */
export const eksternalAktif = (berlakuSampai: string, now: Date = new Date()): boolean => todayJakarta(now) <= berlakuSampai

export const penilaianSidangPath = (id: string): string => `/nilai-sidang/${id}`

export const PERAN_SIDANG: PeranSidang[] = ['ketua', 'anggota_1', 'anggota_2']

/**
 * What Super Admin may add to a sidang, at any date: any missing grade whose dosen is chosen (the Ketua's
 * too), and the lock once all three exist. After the lock it only edits.
 */
export function adminSidang(
  d: Pick<SidangRef, 'penguji_kode' | 'penguji_eksternal_kode' | 'pembimbing_kode'>,
  ada: Set<PeranSidang>,
  locked: boolean,
): { isi: PeranSidang[]; kunci: boolean } {
  if (locked) return { isi: [], kunci: false }
  const kode: Record<PeranSidang, string | null> = { ketua: d.penguji_kode, anggota_1: d.penguji_eksternal_kode, anggota_2: d.pembimbing_kode }
  return { isi: PERAN_SIDANG.filter((p) => !ada.has(p) && !!kode[p]), kunci: PERAN_SIDANG.every((p) => ada.has(p)) }
}

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
  kunci: 'Siap dikunci',
  'menunggu-anggota': 'Menunggu anggota',
  terkirim: 'Terkirim',
  terkunci: 'Terkunci',
}

/** A legacy free-text Anggota Penguji I (no kode) can't grade, so the sidang can't be locked. */
export const ANGGOTA_I_LEGACY = 'Anggota Penguji I belum dipilih dari data dosen'
