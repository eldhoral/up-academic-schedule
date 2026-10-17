import assert from 'node:assert/strict'
import { allEvents, expandKuliah, weekCounts, type KalKuliah, type KalTerm, type KalUjian, type KalSidang } from '../src/app/kalender/items'

// Term: mulai Rabu 2026-09-02 (week 1 Senin 2026-08-31), selesai Jumat 2026-12-18.
const term: KalTerm = { label: '2026/2027 Gasal', mulai: '2026-09-02', selesai: '2026-12-18' }

const k = (o: Partial<KalKuliah> = {}): KalKuliah => ({
  id: 'k1',
  prodi: 's1',
  jenis_kelas: 'reguler',
  semester_ke: 3,
  kode_mk: 'M1',
  nama_mk: 'Psikologi Klinis',
  kelas: 'A',
  hari: 'SENIN',
  jam_mulai: '08.00',
  jam_selesai: '09.40',
  minggu: 'setiap',
  tempat: 'Ruang 301',
  dosen: ['Dr. Budi'],
  is_override: false,
  override_reason: '',
  ...o,
})
const u = (o: Partial<KalUjian> = {}): KalUjian => ({
  id: 'u1',
  prodi: 's1',
  jenis_kelas: 'reguler',
  jenis_ujian: 'uts',
  semester_ke: 3,
  kode_mk: 'M1',
  nama_mk: 'Psikologi Klinis',
  kelas: 'A',
  tanggal: '2026-10-21',
  jam_mulai: '08.00',
  jam_selesai: '10.00',
  keterangan: 'offline',
  room_nama: '201',
  pengawas: [],
  is_override: false,
  ...o,
})
const s = (o: Partial<KalSidang> = {}): KalSidang => ({
  id: 'd1',
  prodi: 's1',
  jenis: 'sidang',
  tanggal: '2027-02-03',
  jam_mulai: '08.00',
  jam_selesai: '10.00',
  npm: '2210001',
  nama_mahasiswa: 'Alfia',
  judul_skripsi: 'Judul',
  room_nama: '302',
  kelompok: null,
  pembimbing: 'Dr. Budi',
  penguji: 'Dr. Ani',
  eksternal: '',
  is_override: false,
  override_reason: '',
  link: '',
  ...o,
})

// kuliah expands to term dates, mid-week start
function testExpandDates() {
  const events = expandKuliah([k()], term, [])
  assert.equal(events[0].tanggal, '2026-09-07', 'first meeting: the next Monday after mulai')
  assert.equal(events.at(-1)!.tanggal, '2026-12-14', 'last Monday on or before selesai')
  assert.equal(events[0].row.nama_mk, 'Psikologi Klinis')
  // ganjil/genap skips weeks: SENIN ganjil = 2026-09-14 (week 3), not 09-07 (week 2)
  assert.equal(expandKuliah([k({ minggu: 'ganjil' })], term, [])[0].tanggal, '2026-09-14')
  assert.equal(expandKuliah([k({ minggu: 'genap' })], term, [])[0].tanggal, '2026-09-07')
}

// exam week pauses only the same prodi + program
function testExamPause() {
  const EXAM = [{ prodi: 's1' as const, jenis_kelas: 'reguler' as const, tanggal: '2026-10-21' }] // week of 2026-10-19
  const events = expandKuliah(
    [k({ hari: 'RABU', id: 'a' }), k({ id: 'b', prodi: 's2', hari: 'RABU' }), k({ id: 'c', jenis_kelas: 'regsus', hari: 'RABU' })],
    term,
    EXAM,
  )
  assert.ok(!events.some((e) => e.id === 'a-2026-10-21'), 's1 reguler pauses in its own exam week')
  assert.ok(events.some((e) => e.id === 'b-2026-10-21'), 's2 keeps meeting')
  assert.ok(events.some((e) => e.id === 'c-2026-10-21'), 'regsus keeps meeting')
}

// no term dates: kuliah stays out, ujian and sidang still stand
function testNoTerm() {
  const noTerm: KalTerm = { label: '2026/2027 Gasal', mulai: null, selesai: null }
  assert.deepEqual(expandKuliah([k()], noTerm, []), [])
  const events = allEvents([k()], [u()], [s()], noTerm, [])
  assert.equal(events.length, 2)
  assert.deepEqual(events.map((e) => e.jenis).sort(), ['sidang', 'ujian'])
}

// ids are unique and typed; counts land on Mondays
function testCounts() {
  const events = allEvents([k({ hari: 'RABU' })], [u(), u({ id: 'u2', tanggal: '2026-10-21' })], [s()], term, [])
  const ids = new Set(events.map((e) => e.id))
  assert.equal(ids.size, events.length, 'ids stay unique per dated event')
  const { weeks, counts } = weekCounts(events)
  assert.match(weeks[0], /2026-08-31/, 'kuliah runs from term week 1')
  assert.match(weeks.at(-1)!, /2027-02-01/, 'the defense week is on the list too')
  assert.equal(weeks.length, 16 + 1, '16 term weeks (mid-week start) + the defense week')
  assert.equal(counts['2026-10-19'], 3, 'wed kuliah once + two same-slot exams on the same week')
}

testExpandDates()
testExamPause()
testNoTerm()
testCounts()
console.log('kalender: all checks passed')
