import assert from 'node:assert/strict'
import { computeAngkatan, romanSemester, substituteTemplate } from '../src/lib/print'
import { hariFromTanggal } from '../src/lib/hari'

// Verified against PLAN.md §6b for AY 2026/2027 Gasal (id "20261").
assert.equal(computeAngkatan('20261', 1), 2026)
assert.equal(computeAngkatan('20261', 3), 2025)
assert.equal(computeAngkatan('20261', 5), 2024)
assert.equal(computeAngkatan('20261', 7), 2023)
assert.equal(computeAngkatan('20261', 2), 2026, 'even semesters share the odd semester below them')

assert.equal(romanSemester(1), 'I')
assert.equal(romanSemester(3), 'III')
assert.equal(romanSemester(8), 'VIII')

assert.equal(
  substituteTemplate('SEMESTER {semester} ANGKATAN {angkatan}', { semester: 'I', angkatan: '2026' }),
  'SEMESTER I ANGKATAN 2026'
)
assert.equal(substituteTemplate('no placeholders here', {}), 'no placeholders here')
assert.equal(substituteTemplate('{missing} stays literal', {}), '{missing} stays literal')

// Dates the faculty sheets use: 27 Oct 2025 was a Monday, 3 Feb 2026 a Tuesday, 24 Nov 2025 a Monday.
assert.equal(hariFromTanggal('2025-10-27'), 'SENIN')
assert.equal(hariFromTanggal('2026-02-03'), 'SELASA')
assert.equal(hariFromTanggal('2025-11-24'), 'SENIN')
assert.equal(hariFromTanggal('2025-11-30'), 'MINGGU')

console.log('print: all checks passed')
