import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_ATURAN, bekukan, loadAturan, parseAturanBeku, validateAspek, validatePilihanYudisium, type AturanBeku,
} from '../src/lib/penilaian/aturan'
import { baris, hasilAkhir, ipkSetelah, nilaiSidang, predikat } from '../src/lib/penilaian/nilai'

// ---- rules
assert.equal(validateAspek(DEFAULT_ATURAN.aspekSidang), null)
assert.equal(DEFAULT_ATURAN.aspekSidang.length, 7)
assert.deepEqual(DEFAULT_ATURAN.aspekSidang.map((a) => a.bobot), [20, 15, 15, 15, 10, 15, 10])
assert.deepEqual(DEFAULT_ATURAN.pilihanYudisium, [
  { label: 'Lulus Tanpa Revisi', lulus: true },
  { label: 'Lulus Dengan Revisi', lulus: true },
  { label: 'Tidak Lulus', lulus: false },
])
assert.equal(validatePilihanYudisium(DEFAULT_ATURAN.pilihanYudisium), null)
assert.notEqual(validatePilihanYudisium([{ label: 'A', lulus: true }]), null)
assert.notEqual(validatePilihanYudisium([{ label: 'A', lulus: false }]), null)
assert.notEqual(validatePilihanYudisium([]), null)
assert.notEqual(validatePilihanYudisium([{ label: 'A', lulus: true }, { label: 'A', lulus: false }]), null)
assert.notEqual(validatePilihanYudisium([{ label: ' ', lulus: true }, { label: 'B', lulus: false }]), null)

// ---- freezing: exactly the keys the DB writes into hasil_sidang.aturan
const beku = bekukan(DEFAULT_ATURAN)
assert.deepEqual(Object.keys(beku).sort(), ['predikat', 'sksSkripsi', 'tabelNilai'])
assert.deepEqual(beku, { tabelNilai: DEFAULT_ATURAN.tabelNilai, predikat: DEFAULT_ATURAN.predikat, sksSkripsi: 6 })
assert.deepEqual(parseAturanBeku(JSON.parse(JSON.stringify(beku))), beku)
for (const bad of [null, 'x', 1, [], {}, { ...beku, sksSkripsi: 0 }, { ...beku, sksSkripsi: '6' }, { ...beku, tabelNilai: [] },
  { ...beku, tabelNilai: [{ min: 50, huruf: 'A', mutu: 4 }] }, { ...beku, predikat: [{ min: 1 }] }, { tabelNilai: beku.tabelNilai, sksSkripsi: 6 }]) {
  assert.equal(parseAturanBeku(bad), null, JSON.stringify(bad))
}

// ---- Nilai Sidang
assert.equal(nilaiSidang([76.5, 76.5, 76.5]), 76.5)
assert.equal(nilaiSidang([80, 70, 75.01]), 75) // 75.0033 -> 75
assert.equal(nilaiSidang([80, 80, 80.01]), 80) // 80.0033 -> 80
assert.equal(nilaiSidang([70, 70, 71.5]), 70.5) // 70.5 exact
assert.equal(nilaiSidang([76.5, 76.5, null]), null)
assert.equal(nilaiSidang([76.5, 76.5]), null)
assert.equal(nilaiSidang([]), null)

// ---- IPK after sidang
assert.equal(ipkSetelah(404.57, 139, 3.67, 6), 2.94)
assert.equal(ipkSetelah(0, 0, 4, 6), 4)

// ---- predikat
const rows = DEFAULT_ATURAN.predikat
assert.equal(predikat(3.6, false, rows), 'Sangat Memuaskan')
assert.equal(predikat(3.6, true, rows), 'Dengan Pujian')
assert.equal(predikat(3.51, true, rows), 'Dengan Pujian')
assert.equal(predikat(3.5, true, rows), 'Sangat Memuaskan')
assert.equal(predikat(3.505, true, rows), 'Dengan Pujian') // compared at 2 decimals
assert.equal(predikat(2.75, false, rows), 'Memuaskan')
assert.equal(predikat(2.76, false, rows), 'Sangat Memuaskan')
assert.equal(predikat(2.94, true, rows), 'Sangat Memuaskan')
assert.equal(predikat(2, false, rows), 'Memuaskan')
assert.equal(predikat(1.9, false, rows), null)
assert.equal(predikat(1.9, true, rows), null)
assert.equal(predikat(4, true, rows), 'Dengan Pujian')
// step down from the lowest row has nowhere to go
assert.equal(predikat(3, false, [{ min: 2, max: 4, predikat: 'Satu', butuhTepatWaktu: true }]), null)
// step down skips rows that also need tepat waktu, and ignores row order
const tiga = [
  { min: 3.51, max: 4, predikat: 'C', butuhTepatWaktu: true },
  { min: 2.76, max: 3.5, predikat: 'B', butuhTepatWaktu: true },
  { min: 2, max: 2.75, predikat: 'A', butuhTepatWaktu: false },
]
assert.equal(predikat(3.8, false, tiga), 'A')
assert.equal(predikat(3.8, true, tiga), 'C')

// ---- hasilAkhir
const lulus: { lulus: boolean; aturan: AturanBeku } = { lulus: true, aturan: beku }
const dasar = { sidang: [76.5, 76.5, 76.5], locked: lulus, bimbingan: 78.5, sks: 139, bobot: 404.57, tepatWaktu: true }
assert.deepEqual(hasilAkhir(dasar), {
  status: 'lengkap', nilaiSidang: 76.5, nilaiAkhir: 77.5, huruf: 'A-', mutu: 3.67,
  ipkSebelum: 2.91, ipkSetelah: 2.94, predikat: 'Sangat Memuaskan',
})
{
  const h = hasilAkhir({ ...dasar, locked: null })
  assert.equal(h.status, 'menunggu-ketua')
  assert.equal(h.nilaiSidang, 76.5)
}
assert.equal(hasilAkhir({ ...dasar, sidang: [76.5, null, 76.5], locked: null }).status, 'menunggu-ketua')
assert.equal(hasilAkhir({ ...dasar, bimbingan: null }).status, 'menunggu-bimbingan')
{
  const h = hasilAkhir({ ...dasar, locked: { lulus: false, aturan: beku }, bimbingan: null })
  assert.equal(h.status, 'tidak-lulus')
  assert.equal(h.nilaiSidang, 76.5)
  assert.ok('alasan' in h && h.alasan.length > 0)
}
{
  const h = hasilAkhir({ ...dasar, sks: null })
  assert.equal(h.status, 'data-kurang')
  assert.ok('alasan' in h && h.alasan === 'SKS/Bobot belum diisi')
  assert.equal(h.nilaiSidang, 76.5)
}
assert.equal(hasilAkhir({ ...dasar, bobot: null }).status, 'data-kurang')
assert.equal(hasilAkhir({ ...dasar, sks: 0 }).status, 'data-kurang')
// locked but a grade missing (corrupt data): reason, never NaN
assert.equal(hasilAkhir({ ...dasar, sidang: [76.5, 76.5, null] }).status, 'data-kurang')
// C+ Nilai Akhir -> 2.33 (the sheet's lookup bug gave 0)
{
  const h = hasilAkhir({ ...dasar, sidang: [61, 61, 61], bimbingan: 61 })
  assert.ok(h.status === 'lengkap')
  assert.equal(h.nilaiAkhir, 61)
  assert.equal(h.huruf, 'C+')
  assert.equal(h.mutu, 2.33)
  assert.equal(baris(61, beku.tabelNilai).mutu, 2.33)
}
// not tepat waktu steps the predikat down
{
  const h = hasilAkhir({ ...dasar, sidang: [90, 90, 90], bimbingan: 90, bobot: 540, sks: 140, tepatWaktu: false })
  assert.ok(h.status === 'lengkap')
  assert.equal(h.ipkSetelah, 3.86) // (540 + 6 * 4) / 146
  assert.equal(h.predikat, 'Sangat Memuaskan')
}
// IPK below every row -> lengkap with null predikat
{
  const h = hasilAkhir({ ...dasar, sidang: [50, 50, 50], bimbingan: 50, bobot: 200, sks: 139 })
  assert.ok(h.status === 'lengkap')
  assert.equal(h.ipkSetelah, 1.42) // (200 + 6 * 1) / 145
  assert.equal(h.predikat, null)
}

// ---- loadAturan: the two new kunci, same per-kunci fallback
function fakeDb(data: { kunci: string; nilai: unknown }[]) {
  return { from: () => ({ select: () => ({ eq: async () => ({ data, error: null }) }) }) } as unknown as SupabaseClient
}
async function main() {
  const kosong = await loadAturan(fakeDb([]), 's1')
  assert.deepEqual(kosong.aspekSidang, DEFAULT_ATURAN.aspekSidang)
  assert.deepEqual(kosong.pilihanYudisium, DEFAULT_ATURAN.pilihanYudisium)
  const ubah = await loadAturan(fakeDb([
    { kunci: 'aspek_sidang', nilai: [{ label: 'X', bobot: 100, sub: ['a'] }] },
    { kunci: 'pilihan_yudisium', nilai: [{ label: 'Ya', lulus: true }, { label: 'Tidak', lulus: false }] },
  ]), 's1')
  assert.equal(ubah.aspekSidang[0].label, 'X')
  assert.deepEqual(ubah.pilihanYudisium.map((p) => p.label), ['Ya', 'Tidak'])
  const rusak = await loadAturan(fakeDb([
    { kunci: 'aspek_sidang', nilai: [{ label: 'X', bobot: 50, sub: [] }] },
    { kunci: 'pilihan_yudisium', nilai: [{ label: 'Ya', lulus: true }] },
  ]), 's1')
  assert.deepEqual(rusak.aspekSidang, DEFAULT_ATURAN.aspekSidang)
  assert.deepEqual(rusak.pilihanYudisium, DEFAULT_ATURAN.pilihanYudisium)
  const bentuk = await loadAturan(fakeDb([{ kunci: 'pilihan_yudisium', nilai: [{ label: 'Ya', lulus: 'ya' }] }]), 's1')
  assert.deepEqual(bentuk.pilihanYudisium, DEFAULT_ATURAN.pilihanYudisium)
  console.log('nilai-sidang: all checks passed')
}
main().catch((e) => { console.error(e); process.exit(1) })
