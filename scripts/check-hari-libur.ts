import assert from 'node:assert/strict'
import { expandKuliah, type KalKuliah } from '../src/app/kalender/items'
import { buildEvents, type JadwalDosen, type KuliahItem } from '../src/app/jadwal-dosen/events'
import { toJadwal } from '../src/app/jadwal-dosen/jadwal-data'
import { liburOn, liburSet } from '../src/lib/hari-libur'

// Term: mulai Rabu 2026-09-02 (week 1 Senin 2026-08-31), selesai Jumat 2026-12-18.
// The RABU class meets 02, 09, 16 … Sep — 09-09 is its second meeting.
const term = { id: '20261', label: '2026/2027 Gasal', mulai: '2026-09-02', selesai: '2026-12-18' }

const kk = (o: Partial<KalKuliah> = {}): KalKuliah => ({
  id: 'k1', prodi: 's1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'M1', nama_mk: 'Psikologi Klinis', kelas: 'A',
  hari: 'RABU', jam_mulai: '08.00', jam_selesai: '09.40', minggu: 'setiap', tempat: 'Ruang 301', dosen: ['Dr. Budi'],
  is_override: false, override_reason: '', ...o,
})
const kj = (o: Partial<KuliahItem> = {}): KuliahItem => ({
  id: 'k1', prodi: 's1', jenis_kelas: 'reguler', nama_mk: 'Psikologi Klinis', kelas: 'A', hari: 'RABU',
  jam_mulai: '08:00', jam_selesai: '09:40', minggu: 'setiap', tempat: 'Ruang 301', ...o,
})
const jadwal = (o: Partial<JadwalDosen> = {}): JadwalDosen => ({
  kodeDosen: 'D1', nama: 'Dr. Budi', term, kuliah: [kj()], ujian: [], sidang: [], examDays: [], libur: [], ...o,
})

// The one holiday on a tanggal, and the set the skip filters use.
function testHelpers() {
  const libur = [{ tanggal: '2026-09-09', label: 'Maulid Nabi' }]
  assert.deepEqual(liburOn(libur, '2026-09-09'), { tanggal: '2026-09-09', label: 'Maulid Nabi' })
  assert.equal(liburOn(libur, '2026-09-08'), null)
  assert.deepEqual([...liburSet(libur)], ['2026-09-09'])
}

// Kalender Gabungan: the marked date has no meeting, the rest of the term is intact.
function testKalDropdown() {
  const dates = (libur: { tanggal: string; label: string }[]) => expandKuliah([kk()], term, [], libur).map((e) => e.tanggal)
  const without = dates([])
  const withLibur = dates([{ tanggal: '2026-09-09', label: 'Maulid Nabi' }])
  assert.ok(without.includes('2026-09-09'), 'sanity: the class meets on 09 Sep')
  assert.ok(!withLibur.includes('2026-09-09'), 'the libur date carries no kuliah meeting')
  assert.equal(withLibur.length, without.length - 1, 'exactly one date removed, nothing else')
}

// The .ics feed: the same rule, expressed as exdates so a repeat event stays valid.
function testIcsExdates() {
  const events = buildEvents(jadwal({ libur: ['2026-09-02', '2026-09-09'] }))
  const kuliahFeed = events.filter((e) => e.uid.startsWith('kuliah-'))
  assert.deepEqual(kuliahFeed.map((e) => e.exdates), [['2026-09-02', '2026-09-09']], 'both Rabu holidays land as exdates; a date with no meeting is irrelevant')
}

// Rows read from the DB land on the feed: libur travels RawJadwal → JadwalDosen.
function testToJadwal() {
  const raw = {
    lecturer: { kode_dosen: 'D1', nama: 'Budi', gelar_depan: '', gelar_belakang: '' },
    term: null,
    schedules: [],
    exams: [],
    defenses: [],
    libur: [{ tanggal: '2026-12-25', label: 'Natal' }],
  }
  assert.deepEqual(toJadwal(raw).libur, ['2026-12-25'], 'no term still carries the declared holidays')
  assert.deepEqual(toJadwal({ ...raw, libur: undefined }).libur, [], 'a caller without holidays (old tests) reads an empty list')
}

testHelpers()
testKalDropdown()
testIcsExdates()
testToJadwal()
console.log('hari libur: all checks passed')
