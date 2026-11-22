import assert from 'node:assert/strict'
import { bacaFilter, cariAman, cariSql, hrefRekap, kolomUrut, urutkan } from '../src/lib/penilaian/rekap-filter'

// Search text that goes into a PostgREST or() filter: only letters, digits, space . ' - survive.
assert.equal(cariAman('  Budi Santoso '), 'Budi Santoso')
assert.equal(cariAman('6010'), '6010')
assert.equal(cariAman('a,b)(c%*"\\d'), 'abcd')
assert.equal(cariAman("O'Neil Sri-Ayu"), "O'Neil Sri-Ayu")
assert.equal(cariAman('x'.repeat(200)).length, 60)

// Unknown sort or status falls back to the defaults; arah is asc unless desc.
const opsi = { urut: ['tanggal', 'npm', 'nilai'] as const, status: ['terkunci', 'belum'] as const }
assert.deepEqual(bacaFilter({ q: ' budi ', urut: 'nilai', arah: 'desc', status: 'terkunci' }, opsi), { q: 'budi', urut: 'nilai', arah: 'desc', status: 'terkunci' })
assert.deepEqual(bacaFilter({ urut: 'drop table', arah: 'x', status: 'aneh', q: ['a', 'b'] }, opsi), { q: '', urut: 'tanggal', arah: 'asc', status: '' })

// Server-side sort: numbers and text, nulls always last, ties keep the incoming (DB) order.
const rows = [{ id: 'a', n: 80 }, { id: 'b', n: null }, { id: 'c', n: 90 }, { id: 'd', n: 80 }]
assert.deepEqual(urutkan(rows, (r) => r.n, 'asc').map((r) => r.id), ['a', 'd', 'c', 'b'])
assert.deepEqual(urutkan(rows, (r) => r.n, 'desc').map((r) => r.id), ['c', 'a', 'd', 'b'])
assert.deepEqual(urutkan([{ s: 'b' }, { s: 'A' }, { s: 'a' }, { s: 'Z' }], (r) => r.s, 'asc').map((r) => r.s), ['a', 'A', 'b', 'Z'], 'locale order, not ASCII (Z after a)')
assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c', 'd'], 'the input is not mutated')

// Links keep the other params; empty ones are dropped.
assert.equal(hrefRekap('/s1/sidang/nilai-akhir', { ay: '2026-1', q: 'budi', status: '', urut: 'nilai', arah: 'desc' }),
  '/s1/sidang/nilai-akhir?ay=2026-1&q=budi&urut=nilai&arah=desc')
// SQL takes the search and the tanggal/NPM/nama sorts; a computed sort stays for the server.
assert.deepEqual(cariSql({ q: 'bu', urut: 'npm', arah: 'desc', status: '' }), { q: 'bu', urut: 'npm', arah: 'desc' })
assert.deepEqual(cariSql({ q: '', urut: 'nilai', arah: 'desc', status: '' }), { q: '' })

// A header link sorts by its column, flipping the direction on the active one; the search and status stay.
const f = { q: 'bu', urut: 'nilai', arah: 'asc' as const, status: 'terkunci' }
assert.deepEqual(kolomUrut('/p', '2026-1', f, 'nilai'), { href: '/p?ay=2026-1&q=bu&status=terkunci&urut=nilai&arah=desc', sort: 'ascending' })
assert.deepEqual(kolomUrut('/p', '2026-1', { ...f, arah: 'desc' }, 'nilai').sort, 'descending')
assert.deepEqual(kolomUrut('/p', '2026-1', f, 'npm'), { href: '/p?ay=2026-1&q=bu&status=terkunci&urut=npm&arah=asc', sort: undefined })
console.log('rekap filter: all checks passed')
