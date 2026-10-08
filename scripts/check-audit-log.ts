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
assert.equal(parseLogFilters({ hal: ['2', '9'] }).page, 2, 'a repeated param takes the first')

// --- logSearchFilter: the text goes into a PostgREST or() string, so nothing may break out of it ---
assert.equal(logSearchFilter(''), null)
assert.equal(logSearchFilter('ani@x.id'), 'actor_email.ilike.*ani@x.id*,record_id.ilike.*ani@x.id*')
// Dots stay (emails need them; PostgREST reads everything after the operator as the value) — commas and parens go.
assert.equal(logSearchFilter('a,b),role.eq.x'), 'actor_email.ilike.*abrole.eq.x*,record_id.ilike.*abrole.eq.x*', 'no comma or paren can add a condition')
assert.equal(logSearchFilter('(),*'), null, 'nothing searchable left')

console.log('audit log: all checks passed')
