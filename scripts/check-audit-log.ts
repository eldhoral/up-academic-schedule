import assert from 'node:assert/strict'
import { logSearchFilter, parseLogFilters } from '../src/lib/audit-log'

// --- parseLogFilters: the URL is user input; anything unknown falls back to "all" --------------
assert.deepEqual(parseLogFilters({}), { page: 1, table: null, action: null, q: '', from: null, to: null })
assert.deepEqual(
  parseLogFilters({ hal: '3', tabel: 'schedules', aksi: 'DELETE', q: ' ani@x.id ', dari: '2026-10-01', sampai: '2026-10-08' }),
  { page: 3, table: 'schedules', action: 'DELETE', q: 'ani@x.id', from: '2026-10-01', to: '2026-10-08' }
)
const junk = parseLogFilters({ hal: '-2', tabel: 'pg_authid', aksi: 'DROP', dari: '1 Oktober', sampai: '2026-13-45x' })
assert.equal(junk.page, 1, 'a page below 1 is page 1')
assert.equal(junk.table, null, 'only tables the log knows')
assert.equal(junk.action, null, 'only known actions')
assert.equal(junk.from, null, 'a date must be YYYY-MM-DD')
assert.equal(junk.to, null)
assert.equal(parseLogFilters({ tabel: 'constructor', aksi: 'toString' }).table, null, 'prototype keys are not tables')
assert.equal(parseLogFilters({ aksi: 'toString' }).action, null, 'prototype keys are not actions')
assert.equal(parseLogFilters({ hal: 'abc' }).page, 1)
assert.equal(parseLogFilters({ hal: '99999999999999' }).page, 10000, 'a huge page is capped so the row range stays a sane number')
assert.equal(parseLogFilters({ hal: ['2', '9'] }).page, 2, 'a repeated param takes the first')

// --- logSearchFilter: the text goes into a PostgREST or() string, so nothing may break out of it ---
assert.equal(logSearchFilter(''), null)
assert.equal(logSearchFilter('ani@x.id'), 'actor_email.ilike.*ani@x.id*,record_id.ilike.*ani@x.id*')
// Dots stay (emails need them; PostgREST reads everything after the operator as the value) — commas and parens go.
assert.equal(logSearchFilter('a,b),role.eq.x'), 'actor_email.ilike.*abrole.eq.x*,record_id.ilike.*abrole.eq.x*', 'no comma or paren can add a condition')
assert.equal(logSearchFilter('(),*'), null, 'nothing searchable left')

// --- history helpers (Riwayat pages): keys become words the scheduler would say --------------
import { changedHistoryFields, fieldLabel, historyIdentity, historyValue, type LookupMaps } from '../src/lib/audit-history'
import type { AuditRow } from '../src/lib/audit-log'

const lookups: LookupMaps = {
  courses: new Map([['PSI101', 'Pengantar Psikologi']]),
  lecturers: new Map([['D-01', 'dr. Ani Widiastuti']]),
  rooms: new Map([['room-1', 'R. 301']]),
}
const row = (over: Partial<AuditRow>): AuditRow => ({
  id: 1, at: '2026-10-12T07:30:00Z', actor_id: null, actor_email: null,
  action: 'UPDATE', table_name: 'schedules', record_id: 'x', old_data: null, new_data: null,
  ...over,
})

assert.equal(historyValue('hari', 'SENIN', lookups), 'Senin')
assert.equal(historyValue('semester_ke', 3, lookups), 'Semester 3')
assert.equal(historyValue('jenis_kelas', 'reguler', lookups), 'Reguler', 'same vocabulary as PROGRAM_LABEL')
assert.equal(historyValue('minggu', 'ganjil', lookups), 'Ganjil')
assert.equal(historyValue('is_override', true, lookups), 'ya')
assert.equal(historyValue('room_id', null, lookups), '—')
assert.equal(historyValue('room_id', 'room-1', lookups), 'R. 301', 'room ids resolve to names')
assert.equal(historyValue('room_id', 'gone', lookups), 'gone', 'an unknown room falls back to the raw id')
assert.equal(historyValue('kode_mk', 'PSI101', lookups), 'PSI101 · Pengantar Psikologi')
assert.equal(historyValue('pembimbing_kode', 'D-01', lookups), 'dr. Ani Widiastuti')
assert.equal(historyValue('penguji_kode', 'D-XX', lookups), 'D-XX')
assert.equal(
  historyValue('pengawas', [{ kode_dosen: 'D-01' }, { nama: 'AKADEMIK' }], lookups),
  'dr. Ani Widiastuti, AKADEMIK',
  'pengawas lists read as names, staff entries stay'
)
assert.equal(historyValue('pengawas', [], lookups), '(kosong)')
assert.equal(fieldLabel('jam_mulai'), 'Jam Mulai')
assert.equal(fieldLabel('desc_x'), 'desc_x', 'unknown columns keep their database name')

assert.deepEqual(
  changedHistoryFields(row({ old_data: { hari: 'SENIN', updated_at: 'a', created_at: 'b' }, new_data: { hari: 'RABU', updated_at: 'c', created_at: 'b' } })),
  ['hari'],
  'only real changes, no timestamps'
)

const history = [
  row({ action: 'INSERT', new_data: { kode_mk: 'PSI101', kelas: 'A', jenis_kelas: 'reguler', semester_ke: 3, academic_year_id: '2025/2026' } }),
  row({ action: 'UPDATE', old_data: { room_id: 'room-1' }, new_data: { room_id: 'room-1' } }),
  row({ action: 'DELETE', old_data: { kode_mk: 'PSI101', kelas: 'A' } }),
]
assert.deepEqual(
  historyIdentity('schedules', history, lookups),
  { title: 'PSI101 · Pengantar Psikologi', chips: ['Kelas A', 'Reguler', 'Semester 3', '2025/2026'] },
  'identity reads from the newest snapshot, not just inserts'
)
assert.equal(
  historyIdentity('defenses', [row({ action: 'INSERT', table_name: 'defenses', new_data: { npm: '20401', nama_mahasiswa: 'Budi' } })], lookups).title,
  'Budi (20401)'
)
assert.equal(
  historyIdentity('courses', [row({ table_name: 'courses', new_data: { kode_mk: 'PSI101', nama_mk: 'Pengantar Psikologi' } })], lookups).title,
  'Pengantar Psikologi',
  'unknown-table identity falls back to a name in the snapshot'
)
assert.deepEqual(changedHistoryFields(history[1]), [], 'a snapshot that equals itself changes nothing')

console.log('audit log: all checks passed')
