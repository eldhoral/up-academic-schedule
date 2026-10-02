import assert from 'node:assert/strict'
import { findClashes, findSlotClashes, timeOverlapMinutes, weeksCollide, type ExistingScheduleForClash, type ScheduleCandidate } from '../src/lib/clash'
import { examKeys, findExamClashes, type ExamClashInput } from '../src/app/ujian/exam-clash'

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

// --- findSlotClashes (dated slots) ------------------------------------------------
{
  const slot = (id: string, tanggal: string | null, a: string | null, b: string | null, keys: string[]) => ({ id, tanggal, jam_mulai: a, jam_selesai: b, keys })
  const one = findSlotClashes([slot('1', '2025-10-27', '08:00', '10:00', ['x']), slot('2', '2025-10-27', '09:00', '11:00', ['x'])])
  assert.equal(one.length, 1)
  assert.equal(one[0].overlapMinutes, 60)
  assert.equal(findSlotClashes([slot('1', '2025-10-27', '08:00', '10:00', ['x']), slot('2', '2025-10-27', '10:00', '12:00', ['x'])]).length, 0, 'back-to-back does not clash')
  assert.equal(findSlotClashes([slot('1', '2025-10-27', '08:00', '10:00', ['x']), slot('2', '2025-10-28', '08:00', '10:00', ['x'])]).length, 0, 'different dates never clash')
  assert.equal(findSlotClashes([slot('1', '2025-10-27', '08:00', '10:00', ['x']), slot('2', '2025-10-27', '08:00', '10:00', ['y'])]).length, 0, 'no shared key, no clash')
  assert.equal(findSlotClashes([slot('1', null, null, null, ['x']), slot('2', null, null, null, ['x'])]).length, 0, 'unscheduled rows are skipped')
  assert.equal(findSlotClashes([slot('1', '2025-10-27', '08:00', '10:00', ['x', 'y']), slot('2', '2025-10-27', '09:00', '10:00', ['x', 'y'])]).length, 2, 'one clash per shared key')
}

// --- exam clashes -------------------------------------------------------------------
{
  const exam = (id: string, o: Partial<ExamClashInput>): ExamClashInput => ({
    id, kode_mk: id, nama_mk: id, jenis_ujian: 'uts', jenis_kelas: 'reguler', semester_ke: 3, kelas: 'A',
    tanggal: '2025-10-27', jam_mulai: '08:00', jam_selesai: '10:00', room_id: null, pengawas: [], keterangan_ujian: 'offline', ...o,
  })
  const kelasMap = new Map([['reguler/3', ['A', 'B']]])
  const cadangan = new Set(['AKADEMIK'])
  const run = (rows: ExamClashInput[]) => findExamClashes(rows, kelasMap, cadangan, new Map([['D1', 'Dr. Budi']]), new Map([['r1', '301']]))

  const dosen = run([exam('m1', { pengawas: [{ kode_dosen: 'D1' }] }), exam('m2', { kelas: 'B', pengawas: [{ kode_dosen: 'D1' }] })])
  assert.deepEqual(dosen.map((c) => c.type), ['pengawas'])
  assert.equal(dosen[0].detail, 'Dr. Budi')

  assert.equal(run([exam('m1', { kelas: 'A', pengawas: [{ nama: 'AKADEMIK' }] }), exam('m2', { kelas: 'B', pengawas: [{ nama: 'akademik' }] })]).length, 0, 'AKADEMIK is a team, never a clash')
  assert.equal(run([exam('m1', { kelas: 'A', pengawas: [{ nama: 'Pak  Joko' }] }), exam('m2', { kelas: 'B', pengawas: [{ nama: 'PAK JOKO' }] })]).length, 1, 'free text matches ignoring case and spacing')
  assert.equal(run([exam('m1', { pengawas: [{ kode_dosen: 'D1' }], keterangan_ujian: 'take_home' }), exam('m2', { kelas: 'B', pengawas: [{ kode_dosen: 'D1' }] })]).length, 0, 'take home occupies nothing')
  assert.deepEqual(examKeys(exam('m', { keterangan_ujian: 'online', room_id: 'r1' }), kelasMap, cadangan), ['kelas:reguler/3/A'], 'online has no room')
  assert.equal(run([exam('m1', { room_id: 'r1' }), exam('m2', { kelas: 'B', room_id: 'r1' })]).some((c) => c.type === 'ruangan'), true)

  // GABUNGAN sits every kelas of the semester, so it clashes with a single-kelas exam.
  const g = run([exam('m1', { kelas: 'GABUNGAN' }), exam('m2', { kelas: 'B' })])
  assert.deepEqual(g.map((c) => c.type), ['kelas'])

  // Kelas A and B of one mata kuliah sit together: same room and proctor is fine.
  assert.equal(run([exam('m1', { kelas: 'A', room_id: 'r1', pengawas: [{ kode_dosen: 'D1' }] }), exam('m1', { id: 'm1b', kelas: 'B', room_id: 'r1', pengawas: [{ kode_dosen: 'D1' }] })]).length, 0)
}

console.log('clash: all checks passed')
