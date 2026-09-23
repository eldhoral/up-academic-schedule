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
