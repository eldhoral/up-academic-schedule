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

/** The "Hari aktif kuliah" setting (e.g. 'SENIN,SELASA') as days in week order; empty or unreadable means every day. */
export function hariAktif(setting: string | undefined): HariDb[] {
  const on = new Set((setting ?? '').split(',').map((s) => s.trim().toUpperCase()))
  const days = HARI_DB.filter((h) => on.has(h))
  return days.length ? days : [...HARI_DB]
}

/** Title-case Indonesian label for the admin UI. Falls back to the raw value for unknown input. */
export function hariLabel(hari: string): string {
  return HARI_LABEL_ID[hari as HariDb] ?? hari
}

/** The hari (DB value, e.g. 'SENIN') an ISO date 'YYYY-MM-DD' falls on. UTC on purpose: a plain date has no timezone. */
export function hariFromTanggal(iso: string): HariDb {
  return HARI_DB[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]
}

/** 'SELASA, 3 FEBRUARI 2026' -- the date line of the sidang sheets; `upper: false` gives 'Selasa, 3 Februari 2026'. */
export function tanggalPanjang(iso: string, upper = true): string {
  const text = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
  return upper ? text.toUpperCase() : text
}
