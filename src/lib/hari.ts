// The DB stores and prints Indonesian day names (checked by the `hari` column
// constraint). The admin UI shows English — PLAN.md §4 "Language": a real
// split, not an oversight. This is the one place that bridges the two.

export const HARI_DB = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const
export type HariDb = (typeof HARI_DB)[number]

const HARI_LABEL_EN: Record<HariDb, string> = {
  SENIN: 'Monday',
  SELASA: 'Tuesday',
  RABU: 'Wednesday',
  KAMIS: 'Thursday',
  JUMAT: 'Friday',
  SABTU: 'Saturday',
}

/** English label for the admin interface. Falls back to the raw value for unknown input. */
export function hariLabel(hari: string): string {
  return HARI_LABEL_EN[hari as HariDb] ?? hari
}
