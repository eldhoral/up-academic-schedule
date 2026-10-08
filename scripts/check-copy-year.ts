import assert from 'node:assert/strict'
import { copiedLecturers, copiedSchedules, previousYearId, type SourceSchedule } from '../src/app/[prodi]/kuliah/copy-year'

// --- previousYearId: same term, one year back ----------------------------------
assert.equal(previousYearId('20261'), '20251')
assert.equal(previousYearId('20262'), '20252')
assert.equal(previousYearId('20300'), '20290')
assert.equal(previousYearId('2026/2027'), null, 'an id off the YYYYT convention has no known previous term')
assert.equal(previousYearId(''), null)

// --- copiedSchedules: the slot carries over, this year's numbers do not ----------
const source: SourceSchedule[] = [
  {
    prodi: 's1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK1', kelas: 'A',
    hari: 'SENIN', jam_mulai: '07:30:00', jam_selesai: '09:10:00', room_id: 'R1', zoom_id: 'Z1', minggu: 'setiap', keterangan: 'Lab',
    schedule_lecturers: [{ kode_dosen: 'D2', urutan: 2 }, { kode_dosen: 'D1', urutan: 1 }],
  },
  {
    prodi: 's1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK2', kelas: 'A',
    hari: 'RABU', jam_mulai: '13:00:00', jam_selesai: '14:40:00', room_id: null, zoom_id: '', minggu: 'ganjil', keterangan: '',
    schedule_lecturers: [],
  },
]
// A room retired since last year is dropped: the form only offers active rooms, so editing would clear it silently.
assert.equal(copiedSchedules(source, '20261', new Set())[0].room_id, null, 'an inactive room is not copied')
assert.deepEqual(copiedSchedules(source, '20261', new Set(['R1']))[0], {
  academic_year_id: '20261',
  prodi: 's1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK1', kelas: 'A',
  hari: 'SENIN', jam_mulai: '07:30:00', jam_selesai: '09:10:00', room_id: 'R1', zoom_id: 'Z1', minggu: 'setiap', keterangan: 'Lab',
  jumlah_mhs: 0, is_override: false, override_reason: '', override_by: null,
})

// --- copiedLecturers: only rows actually inserted get their dosen ----------------
// MK2 already existed in the target year (upsert skipped it), so it is not in `inserted`.
assert.deepEqual(copiedLecturers(source, [{ id: 'new-1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK1', kelas: 'A' }]), [
  { schedule_id: 'new-1', kode_dosen: 'D2', urutan: 2 },
  { schedule_id: 'new-1', kode_dosen: 'D1', urutan: 1 },
])
assert.deepEqual(copiedLecturers(source, []), [], 'nothing inserted, nothing to attach')

console.log('copy year: all checks passed')
