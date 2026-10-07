import assert from 'node:assert/strict'
import { findClashes, findSlotClashes, orientFinding, timeOverlapMinutes, weeksCollide, type ExistingScheduleForClash, type ScheduleCandidate } from '../src/lib/clash'
import { examKeys, findExamClashes, type ExamClashInput } from '../src/app/ujian/exam-clash'
import { defenseKeys, findDefenseClashes, findTeachingOverlaps, type DefenseClashInput } from '../src/app/sidang/defense-clash'

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
    prodi: 's1',
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
    prodi: 's1',
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
    id, prodi: 's1', kode_mk: id, nama_mk: id, jenis_ujian: 'uts', jenis_kelas: 'reguler', semester_ke: 1, kelas: 'A',
    tanggal: '2025-10-27', jam_mulai: '08:00', jam_selesai: '10:00', room_id: null, pengawas: [], keterangan_ujian: 'offline', ...o,
  })
  const kelasMap = new Map([['s1/reguler/1', ['A', 'B']], ['s2/reguler/1', ['A']]])
  const cadangan = new Set(['AKADEMIK'])
  const run = (rows: ExamClashInput[]) => findExamClashes(rows, kelasMap, cadangan, new Map([['D1', 'Dr. Budi']]), new Map([['r1', '301']]))

  const dosen = run([exam('m1', { pengawas: [{ kode_dosen: 'D1' }] }), exam('m2', { kelas: 'B', pengawas: [{ kode_dosen: 'D1' }] })])
  assert.deepEqual(dosen.map((c) => c.type), ['pengawas'])
  assert.equal(dosen[0].detail, 'Dr. Budi')

  assert.equal(run([exam('m1', { kelas: 'A', pengawas: [{ nama: 'AKADEMIK' }] }), exam('m2', { kelas: 'B', pengawas: [{ nama: 'akademik' }] })]).length, 0, 'AKADEMIK is a team, never a clash')
  assert.equal(run([exam('m1', { kelas: 'A', pengawas: [{ nama: 'Pak  Joko' }] }), exam('m2', { kelas: 'B', pengawas: [{ nama: 'PAK JOKO' }] })]).length, 1, 'free text matches ignoring case and spacing')
  assert.equal(run([exam('m1', { pengawas: [{ kode_dosen: 'D1' }], keterangan_ujian: 'take_home' }), exam('m2', { kelas: 'B', pengawas: [{ kode_dosen: 'D1' }] })]).length, 0, 'take home occupies nothing')
  assert.deepEqual(examKeys(exam('m', { keterangan_ujian: 'online', room_id: 'r1' }), kelasMap, cadangan), ['kelas:s1/reguler/1/A'], 'online has no room')
  assert.equal(run([exam('m1', { room_id: 'r1' }), exam('m2', { kelas: 'B', room_id: 'r1' })]).some((c) => c.type === 'ruangan'), true)

  // GABUNGAN sits every kelas of the semester, so it clashes with a single-kelas exam.
  const g = run([exam('m1', { kelas: 'GABUNGAN' }), exam('m2', { kelas: 'B' })])
  assert.deepEqual(g.map((c) => c.type), ['kelas'])

  // Kelas A and B of one mata kuliah sit together: same room and proctor is fine.
  assert.equal(run([exam('m1', { kelas: 'A', room_id: 'r1', pengawas: [{ kode_dosen: 'D1' }] }), exam('m1', { id: 'm1b', kelas: 'B', room_id: 'r1', pengawas: [{ kode_dosen: 'D1' }] })]).length, 0)
}

// --- defense clashes ----------------------------------------------------------------------
{
  const d = (id: string, o: Partial<DefenseClashInput>): DefenseClashInput => ({
    id, prodi: 's1', jenis: 'sidang', tanggal: '2026-02-03', jam_mulai: '08:00', jam_selesai: '10:00', room_id: 'r301', kelompok: null, npm: id, nama_mahasiswa: id,
    pembimbing_kode: 'D1', penguji_kode: 'D2', penguji_eksternal: 'Prof. Farida', ...o,
  })
  const names = new Map([['D1', 'Dr. Budi'], ['D3', 'Dr. Ani']])
  const rooms = new Map([['r301', '301']])
  const run = (rows: DefenseClashInput[]) => findDefenseClashes(rows, names, rooms)
  const types = (rows: DefenseClashInput[]) => run(rows).map((c) => c.type).sort()

  assert.deepEqual(defenseKeys(d('a', {})), ['dosen:D1', 'dosen:D2', 'nama:PROF. FARIDA', 'ruang:r301'])
  assert.deepEqual(defenseKeys(d('a', { jenis: 'prasidang', room_id: null, kelompok: 2, penguji_eksternal: '' })), ['dosen:D1', 'dosen:D2', 'kelompok:s1:2'])

  // Same dosen in two rooms at once, and a different external examiner each time.
  const dosen = run([d('a', { room_id: 'r301', penguji_eksternal: 'X' }), d('b', { room_id: 'r302', penguji_eksternal: 'Y', penguji_kode: 'D3' })])
  assert.deepEqual(dosen.map((c) => c.type), ['dosen'])
  assert.equal(dosen[0].detail, 'Dr. Budi')

  assert.deepEqual(types([d('a', { pembimbing_kode: 'D1', penguji_kode: 'D2' }), d('b', { pembimbing_kode: 'D3', penguji_kode: 'D4', penguji_eksternal: 'Y' })]), ['ruangan'], 'same room, different people')
  assert.deepEqual(types([d('a', { room_id: 'r301' }), d('b', { room_id: 'r302', pembimbing_kode: 'D3', penguji_kode: 'D4' })]), ['eksternal'], 'same external examiner in two rooms')
  assert.equal(run([d('a', { penguji_eksternal: 'Prof.  FARIDA', room_id: 'r301' }), d('b', { room_id: 'r302', pembimbing_kode: 'D3', penguji_kode: 'D4', penguji_eksternal: 'prof. farida' })]).filter((c) => c.type === 'eksternal').length, 1, 'external names match ignoring case and spacing')
  // A dosen cannot be at a prasidang and a sidang at the same time.
  assert.ok(types([d('a', {}), d('b', { jenis: 'prasidang', room_id: null, kelompok: 1, penguji_eksternal: '' })]).includes('dosen'))
  assert.equal(run([d('a', {}), d('b', { jam_mulai: '10:00', jam_selesai: '12:00' })]).length, 0, 'back-to-back does not clash')
  assert.equal(run([d('a', {}), d('b', { tanggal: '2026-02-04' })]).length, 0, 'different dates do not clash')
  assert.deepEqual(types([d('a', { jenis: 'prasidang', room_id: null, kelompok: 1, penguji_eksternal: '', pembimbing_kode: 'D1', penguji_kode: 'D2' }), d('b', { jenis: 'prasidang', room_id: null, kelompok: 1, penguji_eksternal: '', pembimbing_kode: 'D3', penguji_kode: 'D4' })]), ['ruangan'], 'same kelompok')

  // Teaching: 27 Oct 2025 is a Monday.
  const teach = [{ prodi: 's1' as const, hari: 'SENIN', jam_mulai: '08:00', jam_selesai: '10:00', nama_mk: 'Psikologi Umum', kelas: 'A', dosenCodes: ['D1'] }]
  const on = (o: Partial<DefenseClashInput>) => findTeachingOverlaps([d('a', { tanggal: '2025-10-27', jam_mulai: '09:00', jam_selesai: '11:00', ...o })], teach)
  assert.equal(on({}).length, 1)
  assert.equal(on({})[0].overlapMinutes, 60)
  assert.equal(on({ tanggal: '2025-10-28' }).length, 0, 'a Tuesday')
  assert.equal(on({ jam_mulai: '10:00', jam_selesai: '12:00' }).length, 0, 'after class')
  assert.equal(on({ pembimbing_kode: 'D3' }).length, 0, 'the teaching dosen is not on this defense')
}

// --- cross-prodi: a dosen and a room are shared, a kelas and a kelompok are not -------------------
{
  const s2Row = (o: Partial<ExistingScheduleForClash>) => row({ prodi: 's2', ...o })
  const s2Candidate = (o: Partial<ScheduleCandidate>) => candidate({ prodi: 's2', ...o })

  const dosen = findClashes(s2Candidate({ kelas: 'A', dosenCodes: ['D9'] }), [row({ kelas: 'B', dosenCodes: ['D9'], dosenNames: ['Dr. Lintas'] })])
  assert.deepEqual(dosen.map((c) => c.type), ['dosen'], 'one dosen teaching S1 and S2 at once clashes')

  const room = findClashes(s2Candidate({ kelas: 'A', room_id: 'r301' }), [row({ kelas: 'B', room_id: 'r301', room_nama: '301' })])
  assert.deepEqual(room.map((c) => c.type), ['ruangan'], 'rooms are shared')

  assert.equal(findClashes(s2Candidate({}), [row({})]).length, 0, 'S1 kelas C smt 1 and S2 kelas C smt 1 are different students')
  assert.equal(findClashes(s2Candidate({}), [s2Row({})]).filter((c) => c.type === 'kelas').length, 1, 'same kelas inside S2 still clashes')
}
{
  const exam = (id: string, o: Partial<ExamClashInput>): ExamClashInput => ({
    id, prodi: 's1', kode_mk: id, nama_mk: id, jenis_ujian: 'uts', jenis_kelas: 'reguler', semester_ke: 1, kelas: 'A',
    tanggal: '2025-10-27', jam_mulai: '08:00', jam_selesai: '10:00', room_id: null, pengawas: [], keterangan_ujian: 'offline', ...o,
  })
  const kelasMap = new Map([['s1/reguler/1', ['A', 'B']], ['s2/reguler/1', ['A']]])
  const run = (rows: ExamClashInput[]) => findExamClashes(rows, kelasMap, new Set(), new Map([['D9', 'Dr. Lintas']]), new Map())

  assert.deepEqual(run([exam('m1', { pengawas: [{ kode_dosen: 'D9' }] }), exam('m2', { prodi: 's2', pengawas: [{ kode_dosen: 'D9' }] })]).map((c) => c.type), ['pengawas'], 'one pengawas in S1 and S2 at once')
  assert.equal(run([exam('m1', {}), exam('m2', { prodi: 's2' })]).length, 0, 'kelas A of S1 and kelas A of S2 sit apart')
  assert.equal(run([exam('m1', { kelas: 'GABUNGAN' }), exam('m2', { prodi: 's2', kelas: 'A' })]).length, 0, 'S1 GABUNGAN covers S1 kelas only')
  assert.deepEqual(run([exam('m1', { kelas: 'GABUNGAN' }), exam('m2', { kelas: 'B' })]).map((c) => c.detail), ['Kelas B (smt 1)'], 'detail text still reads kelas and smt')
}
{
  const d = (id: string, o: Partial<DefenseClashInput>): DefenseClashInput => ({
    id, prodi: 's1', jenis: 'prasidang', tanggal: '2026-02-03', jam_mulai: '08:00', jam_selesai: '10:00', room_id: null, kelompok: 1, npm: id, nama_mahasiswa: id,
    pembimbing_kode: 'D1', penguji_kode: 'D2', penguji_eksternal: '', ...o,
  })
  const run = (rows: DefenseClashInput[]) => findDefenseClashes(rows, new Map(), new Map())
  assert.equal(run([d('a', {}), d('b', { prodi: 's2', pembimbing_kode: 'D3', penguji_kode: 'D4' })]).length, 0, 'kelompok 1 of S1 and of S2 are different Zoom rooms')
  assert.deepEqual(run([d('a', {}), d('b', { prodi: 's2', pembimbing_kode: 'D1', penguji_kode: 'D4', kelompok: 2 })]).map((c) => c.type), ['dosen'], 'one penguji in S1 and S2 at once')
  assert.equal(run([d('a', {}), d('b', { kelompok: 1, pembimbing_kode: 'D3', penguji_kode: 'D4' })])[0].detail, 'Kelompok 1')

  // 27 Oct 2025 is a Monday: an S2 seminar while its penguji teaches S1.
  const teach = [{ prodi: 's1' as const, hari: 'SENIN', jam_mulai: '08:00', jam_selesai: '10:00', nama_mk: 'Psikologi Umum', kelas: 'A', dosenCodes: ['D1'] }]
  assert.equal(findTeachingOverlaps([d('a', { prodi: 's2', tanggal: '2025-10-27' })], teach).length, 1, 'teaching in the other prodi still counts')
}
{
  type Side = { prodi: 's1' | 's2'; n: string }
  const f = (a: Side, b: Side | null) => ({ a, b, type: 'dosen' })
  assert.equal(orientFinding('s2', f({ prodi: 's1', n: 'x' }, { prodi: 's1', n: 'y' })), null, 'an S1-only clash is not shown on S2')
  assert.equal(orientFinding('s2', f({ prodi: 's1', n: 'x' }, { prodi: 's2', n: 'y' }))?.a.n, 'y', 'the current prodi side leads')
  assert.equal(orientFinding('s1', f({ prodi: 's1', n: 'x' }, { prodi: 's2', n: 'y' }))?.a.n, 'x')
  assert.equal(orientFinding('s1', f({ prodi: 's1', n: 'x' }, null))?.a.n, 'x', 'a one-sided finding (teaching overlap) keeps its side')
  assert.equal(orientFinding('s2', f({ prodi: 's1', n: 'x' }, null)), null)
}

console.log('clash: all checks passed')
