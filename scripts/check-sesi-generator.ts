import assert from 'node:assert/strict'
import { generateDaySessions } from '../src/lib/sesi-generator'

// Plain back-to-back slots, no break-window interference.
const basic = generateDaySessions({
  startJam: '07:30',
  pattern: [2, 2, 3],
  jedaMenit: 10,
  menitPerSks: 50,
})
assert.deepEqual(basic[0], { sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:10', sks: 2 })
assert.deepEqual(basic[1], { sesi_ke: 2, jam_mulai: '09:20', jam_selesai: '11:00', sks: 2 })
assert.deepEqual(basic[2], { sesi_ke: 3, jam_mulai: '11:10', jam_selesai: '13:40', sks: 3 })

// A slot that would straddle the midday break jumps to after the break.
const withBreak = generateDaySessions({
  startJam: '11:30',
  pattern: [2],
  jedaMenit: 10,
  menitPerSks: 50,
  istirahatMulai: '12:10',
  istirahatSelesai: '13:00',
})
assert.deepEqual(withBreak[0], { sesi_ke: 1, jam_mulai: '13:00', jam_selesai: '14:40', sks: 2 })

// Evening (regsus) start past the break window is untouched by it.
const evening = generateDaySessions({
  startJam: '18:00',
  pattern: [3, 3],
  jedaMenit: 10,
  menitPerSks: 50,
  istirahatMulai: '12:10',
  istirahatSelesai: '13:00',
})
assert.deepEqual(evening[0], { sesi_ke: 1, jam_mulai: '18:00', jam_selesai: '20:30', sks: 3 })
assert.deepEqual(evening[1], { sesi_ke: 2, jam_mulai: '20:40', jam_selesai: '23:10', sks: 3 })

// startSesiKe continues numbering when appending to an existing day.
const continued = generateDaySessions({
  startJam: '15:00',
  pattern: [2],
  jedaMenit: 10,
  menitPerSks: 50,
  startSesiKe: 5,
})
assert.equal(continued[0].sesi_ke, 5)

console.log('sesi-generator: all checks passed')
