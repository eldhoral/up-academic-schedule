import assert from 'node:assert/strict'
import { sesiBaruDariJadwal, type MasterSesi } from '../src/lib/sesi-dari-jadwal'

const input = {
  prodi: 's1' as const,
  jenis_kelas: 'reguler' as const,
  hari: 'SENIN',
  jam_mulai: '07:30',
  jam_selesai: '09:10',
  sks: 2,
}

// A free-time row with no matching master session creates an active one, numbered from 1.
assert.deepEqual(sesiBaruDariJadwal([], input), {
  prodi: 's1', jenis_kelas: 'reguler', hari: 'SENIN', jam_mulai: '07:30', jam_selesai: '09:10', sks: 2,
  sesi_ke: 1, active: true,
})

// An existing session with the same slot is not saved again (DB times carry seconds).
const ada: MasterSesi[] = [
  { jenis_kelas: 'reguler', hari: 'SENIN', jam_mulai: '07:30:00', jam_selesai: '09:10:00', sks: 2, sesi_ke: 1 },
]
assert.equal(sesiBaruDariJadwal(ada, input), null)

// A different SKS at the same time is a different master session.
assert.deepEqual(sesiBaruDariJadwal(ada, { ...input, sks: 3 }), {
  prodi: 's1', jenis_kelas: 'reguler', hari: 'SENIN', jam_mulai: '07:30', jam_selesai: '09:10', sks: 3,
  sesi_ke: 2, active: true,
})

// The next number counts only sessions of the same day and program.
const lain: MasterSesi[] = [
  { jenis_kelas: 'reguler', hari: 'SENIN', jam_mulai: '10:30', jam_selesai: '12:10', sks: 2, sesi_ke: 4 },
  { jenis_kelas: 'reguler', hari: 'RABU', jam_mulai: '07:30', jam_selesai: '09:10', sks: 2, sesi_ke: 9 },
  { jenis_kelas: 'regsus', hari: 'SENIN', jam_mulai: '18:30', jam_selesai: '20:10', sks: 2, sesi_ke: 7 },
]
assert.equal(sesiBaruDariJadwal(lain, input)?.sesi_ke, 5)

// A course without a usable SKS cannot become a master session.
assert.equal(sesiBaruDariJadwal([], { ...input, sks: 0 }), null)

console.log('sesi-dari-jadwal: all checks passed')
