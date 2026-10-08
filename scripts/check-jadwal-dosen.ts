import assert from 'node:assert/strict'
import { buildEvents, kuliahDates, termWeek, type JadwalDosen, type KuliahItem, type SidangItem, type UjianItem } from '../src/app/jadwal-dosen/events'
import { isJadwalToken, newJadwalToken } from '../src/app/jadwal-dosen/token'

// Term: mulai Rabu 2026-09-02 (week 1 = Senin 2026-08-31), selesai Jumat 2026-12-18.
const term = { id: '20261', label: '2026/2027 Gasal', mulai: '2026-09-02', selesai: '2026-12-18' }
const M = term.mulai
const S = term.selesai
const k = (o: Partial<KuliahItem> = {}): KuliahItem => ({
  id: 'k1', prodi: 's1', jenis_kelas: 'reguler', nama_mk: 'Psikologi Klinis', kelas: 'A', hari: 'SENIN',
  jam_mulai: '08:00', jam_selesai: '09:40', minggu: 'setiap', tempat: 'Ruang 301', ...o,
})
const u = (o: Partial<UjianItem> = {}): UjianItem => ({
  id: 'u1', prodi: 's1', jenis_kelas: 'reguler', jenis_ujian: 'uts', nama_mk: 'Psikologi Klinis', kelas: 'A', tanggal: '2026-10-21',
  jam_mulai: '08:00', jam_selesai: '10:00', keterangan: 'offline', tempat: 'Ruang 301', peran: ['pengawas'], ...o,
})
const sd = (o: Partial<SidangItem> = {}): SidangItem => ({
  id: 'd1', prodi: 's1', jenis: 'sidang', tanggal: '2027-02-03', jam_mulai: '08:00', jam_selesai: '10:00',
  nama_mahasiswa: 'Alfia', peran: 'penguji', tempat: 'Ruang 301', ...o,
})
const base = (o: Partial<JadwalDosen> = {}): JadwalDosen => ({ kodeDosen: 'D1', nama: 'Dr. Budi', term, kuliah: [], ujian: [], sidang: [], examDays: [], ...o })

// --- term weeks: the Senin..Minggu week containing mulai is week 1 -----------------------------
assert.equal(termWeek('2026-08-31', M), 1)
assert.equal(termWeek('2026-09-02', M), 1)
assert.equal(termWeek('2026-09-06', M), 1, 'Minggu closes week 1')
assert.equal(termWeek('2026-09-07', M), 2)

// --- first meetings when the term starts mid-week ----------------------------------------------
assert.equal(kuliahDates(k(), M, S)[0], '2026-09-07', 'setiap Senin: the next Monday')
assert.deepEqual(kuliahDates(k({ minggu: 'ganjil' }), M, S).slice(0, 2), ['2026-09-14', '2026-09-28'], 'ganjil: week 1 Monday has passed, so week 3')
assert.deepEqual(kuliahDates(k({ minggu: 'genap' }), M, S).slice(0, 2), ['2026-09-07', '2026-09-21'])
assert.equal(kuliahDates(k({ hari: 'RABU' }), M, S)[0], '2026-09-02', 'a class on the start day meets that day')
assert.equal(kuliahDates(k(), M, S).at(-1), '2026-12-14', 'last Monday on or before selesai')
assert.deepEqual(kuliahDates(k({ hari: 'BUKAN' }), M, S), [], 'unknown hari: no dates')

// --- exam weeks: same prodi and jenis kelas only -------------------------------------------------
{
  const examDays = [
    { prodi: 's1' as const, jenis_kelas: 'reguler' as const, tanggal: '2026-10-21' }, // week of 2026-10-19
    { prodi: 's1' as const, jenis_kelas: 'regsus' as const, tanggal: '2026-10-26' },
    { prodi: 's2' as const, jenis_kelas: 'reguler' as const, tanggal: '2026-11-02' },
  ]
  const events = buildEvents(base({
    kuliah: [k(), k({ id: 'k2', minggu: 'ganjil' }), k({ id: 'k3', minggu: 'genap' }), k({ id: 'k4', jenis_kelas: 'regsus' })],
    examDays,
  }))
  const byUid = Object.fromEntries(events.map((e) => [e.uid, e]))
  assert.deepEqual(byUid['kuliah-k1@krs'].exdates, ['2026-10-19'])
  assert.deepEqual(byUid['kuliah-k2@krs'].exdates, [], 'ganjil never meets in week 8')
  assert.deepEqual(byUid['kuliah-k3@krs'].exdates, ['2026-10-19'])
  assert.deepEqual(byUid['kuliah-k4@krs'].exdates, ['2026-10-26'], 'regsus pauses for its own exams only')
  assert.deepEqual(byUid['kuliah-k1@krs'].repeat, { weeks: 1, until: '2026-12-18' })
  assert.deepEqual(byUid['kuliah-k2@krs'].repeat, { weeks: 2, until: '2026-12-18' })
  assert.equal(byUid['kuliah-k1@krs'].summary, 'Kuliah · Psikologi Klinis (A) · S1')
  assert.equal(byUid['kuliah-k1@krs'].location, 'Ruang 301')
  assert.equal(byUid['kuliah-k1@krs'].start, '08:00')
}

// --- no term dates, or no active term: no kuliah events ----------------------------------------
assert.equal(buildEvents(base({ term: { ...term, mulai: null }, kuliah: [k()] })).length, 0)
assert.equal(buildEvents(base({ term: { ...term, selesai: null }, kuliah: [k()] })).length, 0)
assert.equal(buildEvents(base({ term: null, kuliah: [k()] })).length, 0)

// --- ujian: joined roles, take home all-day, UID survives a time change -------------------------
{
  const [both] = buildEvents(base({ ujian: [u({ peran: ['pengawas', 'pengampu'] })] }))
  assert.equal(both.summary, 'UTS Pengawas & Pengampu · Psikologi Klinis (A) · S1')
  assert.equal(both.start, '08:00')
  const [takeHome] = buildEvents(base({ ujian: [u({ keterangan: 'take_home', tempat: 'Take Home' })] }))
  assert.equal(takeHome.start, undefined, 'take home is all-day')
  assert.equal(takeHome.date, '2026-10-21')
  const [moved] = buildEvents(base({ ujian: [u({ jam_mulai: '13:00', jam_selesai: '15:00' })] }))
  assert.equal(moved.uid, 'ujian-u1@krs', 'UID depends on the row, not its time')
}

// --- sidang wording follows the prodi --------------------------------------------------------------
assert.equal(buildEvents(base({ sidang: [sd()] }))[0].summary, 'Sidang · Ketua Sidang · Alfia · S1')
assert.equal(
  buildEvents(base({ sidang: [sd({ prodi: 's2', jenis: 'prasidang', peran: 'pembimbing', tempat: 'Kelompok 2 (Zoom)' })] }))[0].summary,
  'Seminar Proposal · Dosen Pembimbing Pendamping · Alfia · S2',
)

// --- token ----------------------------------------------------------------------------------------
{
  const a = newJadwalToken()
  const b = newJadwalToken()
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)
  assert.ok(isJadwalToken(a))
  assert.ok(!isJadwalToken('abc'))
  assert.ok(!isJadwalToken(`${a}/`))
  assert.ok(!isJadwalToken(`${a.slice(0, 42)}.`))
}

console.log('jadwal dosen: all checks passed')
