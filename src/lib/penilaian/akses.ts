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
