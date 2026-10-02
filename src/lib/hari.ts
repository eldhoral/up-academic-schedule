export const HARI_DB = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as const
export type HariDb = (typeof HARI_DB)[number]

const HARI_LABEL_ID: Record<HariDb, string> = {
  SENIN: 'Senin',
  SELASA: 'Selasa',
  RABU: 'Rabu',
  KAMIS: 'Kamis',
  JUMAT: 'Jumat',
  SABTU: 'Sabtu',
  MINGGU: 'Minggu',
}

/** Title-case Indonesian label for the admin UI. Falls back to the raw value for unknown input. */
export function hariLabel(hari: string): string {
  return HARI_LABEL_ID[hari as HariDb] ?? hari
}

/** The hari (DB value, e.g. 'SENIN') an ISO date 'YYYY-MM-DD' falls on. UTC on purpose: a plain date has no timezone. */
export function hariFromTanggal(iso: string): HariDb {
  return HARI_DB[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]
}
