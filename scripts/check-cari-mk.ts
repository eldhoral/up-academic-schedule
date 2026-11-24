import assert from 'node:assert/strict'
import { cocokCariMk, kodeMkPersis } from '../src/lib/cari-mk'

const mk = [
  { kode: '15152002', nama: 'KEWIRAUSAHAAN' },
  { kode: '15152003', nama: 'KEPANCASILAAN' },
  { kode: '15152007', nama: 'ENGLISH FOR OCCUPATIONAL PURPOSES' },
  { kode: '15152008', nama: 'PSIKOLOGI SEKOLAH' },
  { kode: '15152010', nama: 'PSIKOLOGI FORENSIK (P)' },
]

// Pencarian kosong tidak menyaring apa pun.
assert.equal(cocokCariMk(mk[0], ''), true)
assert.equal(cocokCariMk(mk[0], '   '), true)

// Kode mk dicocokkan sebagai bagian dari angka, bukan harus dari awal.
assert.equal(cocokCariMk(mk[0], '15152002'), true)
assert.equal(cocokCariMk(mk[0], '2002'), true)
assert.equal(cocokCariMk(mk[1], '2002'), false)

// Nama mk dicocokkan sebagian dan tidak peduli huruf besar/kecil.
assert.equal(cocokCariMk(mk[0], 'wir'), true)
assert.equal(cocokCariMk(mk[0], 'KEWIR'), true)
assert.equal(cocokCariMk(mk[3], 'sekolah'), true)

// Inisial kata: huruf depan tiap kata, kata penghubung boleh dilewati.
assert.equal(cocokCariMk(mk[3], 'ps'), true)
assert.equal(cocokCariMk(mk[2], 'eop'), true)
assert.equal(cocokCariMk(mk[4], 'pf'), true)
assert.equal(cocokCariMk(mk[0], 'xyz'), false)

// Kode yang ditempel persis langsung dipilih; kode sebagian tidak.
assert.equal(kodeMkPersis(mk, ' 15152008 '), '15152008')
assert.equal(kodeMkPersis(mk, '1515200'), null)
assert.equal(kodeMkPersis(mk, 'ps'), null)

console.log('cari-mk: all checks passed')
