import { hariFromTanggal, hariLabel } from './hari'

// Week arithmetic for the dated calendars (ujian, sidang). Plain 'YYYY-MM-DD' strings in UTC,
// so a date never shifts by a day across timezones.

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)
const toIso = (d: Date) => d.toISOString().slice(0, 10)

export function addDays(iso: string, n: number): string {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toIso(d)
}

/** The Monday of the week an ISO date falls in. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7))
}

/** Senin..Sabtu of a week, plus Minggu only when asked (the academic week has no Sunday). */
export function weekDays(monday: string, withSunday = false): string[] {
  return Array.from({ length: withSunday ? 7 : 6 }, (_, i) => addDays(monday, i))
}

/** The Mondays of every week that has at least one date, in order. */
export function eventWeeks(dates: string[]): string[] {
  return [...new Set(dates.map(mondayOf))].sort()
}

/** The week to open on: this week or the next one with events; else the last such week; else this week. */
export function defaultWeek(dates: string[], today: string): string {
  const weeks = eventWeeks(dates)
  const now = mondayOf(today)
  return weeks.find((w) => w >= now) ?? weeks.at(-1) ?? now
}

const dayMonth = (iso: string) => `${parseInt(iso.slice(8, 10), 10)} ${BULAN[parseInt(iso.slice(5, 7), 10) - 1]}`

/** "27 Okt – 1 Nov 2025". */
export function weekLabel(monday: string, withSunday = false): string {
  const end = addDays(monday, withSunday ? 6 : 5)
  return `${dayMonth(monday)} – ${dayMonth(end)} ${end.slice(0, 4)}`
}

/** "Senin 27 Okt", for a day column. */
export const dayLabel = (iso: string) => `${hariLabel(hariFromTanggal(iso))} ${dayMonth(iso)}`
