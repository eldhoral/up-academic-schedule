import { addDays } from '@/lib/week'

// RFC 5545 calendar text for the lecturer feed (jadwal dosen). Times are Asia/Jakarta: UTC+7, no DST.

export type IcsEvent = {
  uid: string
  summary: string
  location?: string
  description?: string
  date: string // YYYY-MM-DD, the (first) occurrence
  start?: string // 'HH:MM' Jakarta; omit start/end for an all-day event
  end?: string
  repeat?: { weeks: 1 | 2; until: string } // until: YYYY-MM-DD, inclusive
  exdates?: string[] // YYYY-MM-DD occurrences to skip
}

const TZ = 'Asia/Jakarta'
const compact = (date: string) => date.replaceAll('-', '')
const local = (date: string, time: string) => `${compact(date)}T${time.replace(':', '')}00`
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines over 75 octets continue on the next line after one space, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    const limit = out.length === 0 ? 75 : 74 // a continuation line spends one octet on its leading space
    if (bytes + size > limit) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

export function toIcs(calName: string, events: IcsEvent[], now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fakultas Psikologi Universitas Pancasila//Jadwal Dosen//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-TIMEZONE:${TZ}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZ}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:WIB',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  const stamp = utcStamp(now)
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`)
    if (e.start && e.end) {
      lines.push(`DTSTART;TZID=${TZ}:${local(e.date, e.start)}`, `DTEND;TZID=${TZ}:${local(e.date, e.end)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`)
    }
    // UNTIL is UTC: 23:59:59 WIB on the last day is 16:59:59Z the same day.
    if (e.repeat) lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=${e.repeat.weeks};UNTIL=${compact(e.repeat.until)}T165959Z`)
    for (const x of e.exdates ?? []) lines.push(e.start ? `EXDATE;TZID=${TZ}:${local(x, e.start)}` : `EXDATE;VALUE=DATE:${compact(x)}`)
    lines.push(`SUMMARY:${escapeText(e.summary)}`)
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
