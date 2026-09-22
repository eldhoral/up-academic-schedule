import assert from 'node:assert/strict'
import { findClashes, timeOverlapMinutes, weeksCollide, type ExistingScheduleForClash, type ScheduleCandidate } from '../src/lib/clash'

// --- weeksCollide -----------------------------------------------------------
assert.equal(weeksCollide('setiap', 'setiap'), true)
assert.equal(weeksCollide('setiap', 'ganjil'), true)
assert.equal(weeksCollide('ganjil', 'setiap'), true)
assert.equal(weeksCollide('ganjil', 'ganjil'), true)
assert.equal(weeksCollide('genap', 'genap'), true)
assert.equal(weeksCollide('ganjil', 'genap'), false, 'alternating (A)/(B) slots must not clash')

// --- timeOverlapMinutes -------------------------------------------------------
assert.equal(timeOverlapMinutes('13:00', '14:40', '13:00', '14:40'), 100)
assert.equal(timeOverlapMinutes('18:00', '20:30', '19:50', '21:30'), 40)
assert.equal(timeOverlapMinutes('07:30', '09:10', '09:10', '11:00'), 0, 'back-to-back slots do not overlap')
assert.equal(timeOverlapMinutes('07:30', '09:10', '10:00', '11:00'), 0)

function row(overrides: Partial<ExistingScheduleForClash>): ExistingScheduleForClash {
  return {
    id: 'existing-1',
    kode_mk: '10012003',
    nama_mk: 'Kewarganegaraan',
    kelas: 'C',
    jenis_kelas: 'reguler',
    semester_ke: 1,
    hari: 'JUMAT',
    jam_mulai: '13:00',
    jam_selesai: '14:40',
    minggu: 'setiap',
    room_id: null,
    room_nama: null,
    dosenCodes: [],
    dosenNames: [],
    ...overrides,
  }
}

function candidate(overrides: Partial<ScheduleCandidate>): ScheduleCandidate {
  return {
    hari: 'JUMAT',
    jam_mulai: '13:00',
    jam_selesai: '14:40',
    minggu: 'setiap',
    kelas: 'C',
    jenis_kelas: 'reguler',
    semester_ke: 1,
    room_id: null,
    dosenCodes: [],
    ...overrides,
  }
}

// Real conflict from PLAN.md §7: SMTR I kelas C, two required courses, same slot.
{
  const clashes = findClashes(candidate({}), [row({})])
  const kelasClash = clashes.find((c) => c.type === 'kelas')
  assert.ok(kelasClash, 'same kelas + jenis + semester at an overlapping time must clash')
  assert.equal(kelasClash!.overlapMinutes, 100)
}

// Dosen clash: same lecturer, different kelas, overlapping time.
{
  const existing = [row({ kelas: 'A', dosenCodes: ['D001'], dosenNames: ['Dr. Evanytha, M.Si.'] })]
  const clashes = findClashes(candidate({ kelas: 'B', dosenCodes: ['D001'] }), existing)
  assert.equal(clashes.length, 1)
  assert.equal(clashes[0].type, 'dosen')
  assert.equal(clashes[0].detail, 'Dr. Evanytha, M.Si.')
}

// Ruangan clash: same room, different kelas and lecturer.
{
  const existing = [row({ kelas: 'A', room_id: 'room-301', room_nama: '301' })]
  const clashes = findClashes(candidate({ kelas: 'B', room_id: 'room-301' }), existing)
  assert.equal(clashes.length, 1)
  assert.equal(clashes[0].type, 'ruangan')
}

// No clash: different hari.
{
  const existing = [row({ hari: 'SENIN' })]
  assert.equal(findClashes(candidate({}), existing).length, 0)
}

// No clash: week parity excludes ganjil vs genap even at the same slot.
{
  const existing = [row({ minggu: 'genap', dosenCodes: ['D002'], dosenNames: ['Vinaya'] })]
  const clashes = findClashes(candidate({ minggu: 'ganjil', dosenCodes: ['D002'] }), existing)
  assert.equal(clashes.length, 0, 'ganjil and genap alternate and must not clash')
}

// A row never clashes with itself when editing (excluded by id).
{
  const existing = [row({ id: 'self', dosenCodes: ['D001'], dosenNames: ['Someone'] })]
  const clashes = findClashes(candidate({ id: 'self', dosenCodes: ['D001'] }), existing)
  assert.equal(clashes.length, 0)
}

// A single overlapping row can trip more than one clash type at once.
{
  const existing = [
    row({ kelas: 'C', room_id: 'room-301', room_nama: '301', dosenCodes: ['D003'], dosenNames: ['Aisyah, M.Si'] }),
  ]
  const clashes = findClashes(candidate({ kelas: 'C', room_id: 'room-301', dosenCodes: ['D003'] }), existing)
  const types = clashes.map((c) => c.type).sort()
  assert.deepEqual(types, ['dosen', 'kelas', 'ruangan'])
}

console.log('clash: all checks passed')
