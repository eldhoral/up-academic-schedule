import assert from 'node:assert/strict'
import { copiedLecturers, copiedSchedules, previousYearId, type SourceSchedule } from '../src/app/[prodi]/kuliah/copy-year'

// --- previousYearId: same term, one year back ----------------------------------
assert.equal(previousYearId('20261'), '20251')
assert.equal(previousYearId('20262'), '20252')
assert.equal(previousYearId('20300'), '20290')
assert.equal(previousYearId('2026/2027'), null, 'an id off the YYYYT convention has no known previous term')
assert.equal(previousYearId(''), null)

// --- copiedSchedules: only the course/class and dosen carry over ----------------
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
// Session and room are left blank for the user to fill in; the rest carry over.
assert.deepEqual(copiedSchedules(source, '20261')[0], {
  academic_year_id: '20261',
  prodi: 's1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK1', kelas: 'A',
  hari: '', jam_mulai: '', jam_selesai: '', room_id: null, zoom_id: '', minggu: 'setiap', keterangan: '',
  jumlah_mhs: 0, is_override: false, override_reason: '', override_by: null,
})
assert.equal(copiedSchedules(source, '20261')[0].room_id, null, 'room is left blank for manual entry')

// --- copiedLecturers: only rows actually inserted get their dosen ----------------
// MK2 already existed in the target year (upsert skipped it), so it is not in `inserted`.
assert.deepEqual(copiedLecturers(source, [{ id: 'new-1', jenis_kelas: 'reguler', semester_ke: 3, kode_mk: 'MK1', kelas: 'A' }]), [
  { schedule_id: 'new-1', kode_dosen: 'D2', urutan: 2 },
  { schedule_id: 'new-1', kode_dosen: 'D1', urutan: 1 },
])
assert.deepEqual(copiedLecturers(source, []), [], 'nothing inserted, nothing to attach')

console.log('copy year: all checks passed')
