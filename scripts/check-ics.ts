import assert from 'node:assert/strict'
import { escapeText, foldLine, toIcs } from '../src/lib/ics'

// --- text escaping (RFC 5545 3.3.11) ---------------------------------------------------------
assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne')

// --- folding: <= 75 octets per line, continuation starts with one space, no split characters --
{
  const line = 'SUMMARY:' + 'Psikologi Perkembangan Anak — Remaja, Kelas A · S1 '.repeat(4)
  const folded = foldLine(line)
  const physical = folded.split('\r\n')
  assert.ok(physical.length > 1, 'a long line is folded')
  physical.forEach((p, i) => {
    assert.ok(Buffer.byteLength(p) <= 75, `line ${i} fits 75 octets`)
    if (i > 0) assert.equal(p[0], ' ', 'continuation starts with a space')
  })
  assert.equal(folded.replace(/\r\n /g, ''), line, 'unfolding gives the original back')
  assert.equal(foldLine('SUMMARY:short'), 'SUMMARY:short')
}

// --- a whole calendar ----------------------------------------------------------------------------
{
  const text = toIcs(
    'Jadwal Dr. Budi, M.Si',
    [
      {
        uid: 'kuliah-k1@krs',
        summary: 'Kuliah · Psikologi Klinis (A) · S1',
        location: 'Ruang 301',
        date: '2026-09-07',
        start: '08:00',
        end: '09:40',
        repeat: { weeks: 1, until: '2026-12-18' },
        exdates: ['2026-10-19'],
      },
      { uid: 'ujian-u1@krs', summary: 'UTS Pengawas · Psikologi Klinis (A) · S1', date: '2026-10-21' },
    ],
    new Date('2026-10-08T03:04:05.000Z'),
  )
  const lines = text.split('\r\n')
  assert.ok(text.endsWith('\r\n'), 'ends with CRLF')
  assert.ok(lines.every((l) => !l.includes('\n')), 'CRLF only, no bare LF')
  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.equal(lines.filter((l) => l === 'BEGIN:VTIMEZONE').length, 1, 'one VTIMEZONE')
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 2)
  for (const expected of [
    'X-WR-CALNAME:Jadwal Dr. Budi\\, M.Si',
    'X-WR-TIMEZONE:Asia/Jakarta',
    'TZOFFSETTO:+0700',
    'DTSTAMP:20261008T030405Z',
    'DTSTART;TZID=Asia/Jakarta:20260907T080000',
    'DTEND;TZID=Asia/Jakarta:20260907T094000',
    'RRULE:FREQ=WEEKLY;INTERVAL=1;UNTIL=20261218T165959Z',
    'EXDATE;TZID=Asia/Jakarta:20261019T080000',
    'LOCATION:Ruang 301',
    'DTSTART;VALUE=DATE:20261021',
    'DTEND;VALUE=DATE:20261022',
  ])
    assert.ok(lines.includes(expected), `has ${expected}`)
  assert.equal(lines.at(-2), 'END:VCALENDAR')
}

console.log('ics: all checks passed')
