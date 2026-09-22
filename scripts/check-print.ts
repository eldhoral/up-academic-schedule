import assert from 'node:assert/strict'
import { computeAngkatan, romanSemester, substituteTemplate } from '../src/lib/print'

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

console.log('print: all checks passed')
