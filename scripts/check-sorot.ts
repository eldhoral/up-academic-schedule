import assert from 'node:assert/strict'
import { barisBerubah } from '../src/components/useSorotSimpan'

const a = { id: 'a', jam: '07:30' }
const b = { id: 'b', jam: '09:00' }
// An edited row and a new row light up; unchanged and removed rows do not.
assert.deepEqual([...barisBerubah([a, b], [{ ...a, jam: '08:00' }, { id: 'c', jam: '10:00' }])], ['a', 'c'])
assert.deepEqual([...barisBerubah([a, b], [a, b])], [])
// The very first row of an empty list counts as new.
assert.deepEqual([...barisBerubah([], [a])], ['a'])
// No row in common (another semester or year was opened): nothing lights up.
assert.deepEqual([...barisBerubah([a], [{ id: 'x', jam: '' }, { id: 'y', jam: '' }])], [])
console.log('sorot: all checks passed')
