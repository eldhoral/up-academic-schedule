import assert from 'node:assert/strict'
import { humanDbError } from '../src/lib/db-error'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_ATURAN, loadAturan, validateAspek, validatePredikat, validateSks, validateTabelNilai,
} from '../src/lib/penilaian/aturan'
import { aksesDosen, bisaDinilai, bolehInputLama, halamanDosen, penilaianPath, peranDosen, todayJakarta, type DefenseRef, type Peran } from '../src/lib/penilaian/akses'
import { buildRekapBimbingan } from '../src/lib/penilaian/rekap'
import { baris, formatNilai, ipkSebelum, nilaiBimbingan, nilaiDariSnapshot, parseAngka, round2, snapshotDariSkor, aspekSama } from '../src/lib/penilaian/nilai'

// ---- validation
assert.equal(validateAspek(DEFAULT_ATURAN.aspekBimbingan), null)
const aspek = (...b: number[]) => b.map((bobot, i) => ({ label: `A${i}`, bobot, sub: [] }))
assert.match(validateAspek(aspek(30, 30, 20, 10)) ?? '', /100/)
assert.notEqual(validateAspek([]), null)
assert.notEqual(validateAspek([{ label: ' ', bobot: 100, sub: [] }]), null)
assert.notEqual(validateAspek(aspek(100, 0)), null)
assert.equal(validateAspek(aspek(33.33, 33.33, 33.34)), null)

assert.equal(validateTabelNilai(DEFAULT_ATURAN.tabelNilai), null)
const tabel = DEFAULT_ATURAN.tabelNilai
assert.notEqual(validateTabelNilai([...tabel, { min: 76, huruf: 'X', mutu: 1 }]), null)
assert.notEqual(validateTabelNilai([...tabel, { min: 50, huruf: 'A', mutu: 1 }]), null)
assert.notEqual(validateTabelNilai(tabel.filter((r) => r.min !== 0)), null)
assert.notEqual(validateTabelNilai([...tabel, { min: 101, huruf: 'X', mutu: 1 }]), null)
assert.notEqual(validateTabelNilai([...tabel, { min: 50, huruf: 'X', mutu: 4.5 }]), null)

assert.equal(validatePredikat(DEFAULT_ATURAN.predikat), null)
const pr = (min: number, max: number) => ({ min, max, predikat: 'P', butuhTepatWaktu: false })
assert.notEqual(validatePredikat([pr(2, 2.75), pr(2.75, 3.5)]), null)
assert.notEqual(validatePredikat([pr(3, 2)]), null)
assert.notEqual(validatePredikat([pr(3, 4.5)]), null)
assert.equal(validatePredikat([pr(2.76, 3.5), pr(2, 2.75)]), null)

assert.equal(validateSks(6), null)
assert.notEqual(validateSks(0), null)
assert.notEqual(validateSks(2.5), null)

// ---- math
assert.equal(round2(75.995), 76)
assert.equal(round2(1.005), 1.01)
const snap = [86, 78, 78, 76].map((skor, i) => ({ label: `A${i}`, bobot: [30, 30, 20, 20][i], skor }))
assert.equal(nilaiDariSnapshot(snap), 80)
assert.equal(baris(80, tabel).huruf, 'A')
assert.equal(nilaiBimbingan(80, 77), 78.5)
assert.equal(baris(78.5, tabel).huruf, 'A-')
assert.equal(nilaiBimbingan(80, null), null)
assert.equal(nilaiBimbingan(null, 80), null)
assert.equal(nilaiBimbingan(76, 75.99), 76)
for (const [n, h] of [[79.99, 'A-'], [75.99, 'B+'], [55.99, 'D'], [44.99, 'E'], [75.995, 'A-'], [100, 'A'], [0, 'E']] as const) {
  assert.equal(baris(n, tabel).huruf, h, `${n} -> ${h}`)
}

const ok = (raw: string, min = 0, max = 100) => parseAngka(raw, min, max)
assert.deepEqual(ok('78,5'), { ok: true, value: 78.5 })
assert.deepEqual(ok('78.5'), { ok: true, value: 78.5 })
assert.deepEqual(ok(' 80 '), { ok: true, value: 80 })
for (const bad of ['', 'abc', '100,01', '-1', '1,234', '1,2,3', '1e2']) assert.equal(ok(bad).ok, false, `"${bad}"`)
assert.deepEqual(parseAngka('404,57', 0, 9999), { ok: true, value: 404.57 })

assert.equal(ipkSebelum(404.57, 139), 2.91)
assert.equal(ipkSebelum(null, 139), null)
assert.equal(ipkSebelum(404.57, null), null)
assert.equal(formatNilai(78.5), '78,50')
assert.equal(formatNilai(80), '80,00')

// ---- snapshot from typed scores (the shape the grading actions store)
const empat = DEFAULT_ATURAN.aspekBimbingan
const s80 = snapshotDariSkor(empat, ['86', '78', '78,0', '76'])
assert.ok('aspek' in s80)
assert.deepEqual(s80.aspek.map((r) => [r.label, r.bobot, r.skor]), empat.map((a, i) => [a.label, a.bobot, [86, 78, 78, 76][i]]))
assert.equal(nilaiDariSnapshot(s80.aspek), 80)
assert.ok(!('sub' in s80.aspek[0]), 'snapshot keeps label + bobot + skor only')
// a stored snapshot re-scores against its own rows, whatever the current list is
const lama = [{ label: 'Lama', bobot: 100, skor: 50 }]
const ulang = snapshotDariSkor(lama, ['70'])
assert.ok('aspek' in ulang)
assert.deepEqual(ulang.aspek, [{ label: 'Lama', bobot: 100, skor: 70 }])
for (const bad of [['86', '78', '78'], ['86', '78', '78', '76', '1'], 'x', null, [86, 78, 78, 76]]) {
  assert.ok('error' in snapshotDariSkor(empat, bad), `${JSON.stringify(bad)} refused`)
}
const salah = snapshotDariSkor(empat, ['86', '101', '78', '76'])
assert.ok('error' in salah && salah.error.startsWith('Pemahaman Penelitian:'), 'names the bad row')

// the aspek list a form showed must still be the current one
const tampil = empat.map((a): [string, number] => [a.label, a.bobot])
assert.equal(aspekSama(tampil, empat), true)
assert.equal(aspekSama(tampil.map(([l, b], i) => [i === 0 ? `${l} (baru)` : l, b]), empat), false, 'label changed')
assert.equal(aspekSama(tampil.map(([l, b], i) => [l, i === 0 ? b + 5 : b]), empat), false, 'bobot changed')
assert.equal(aspekSama([...tampil].reverse(), empat), false, 'order changed')
assert.equal(aspekSama(tampil.slice(1), empat), false, 'row removed')
for (const bad of [null, 'x', [['a']], tampil.map(([l]) => l), tampil.map(([l, b]) => [l, String(b)])]) {
  assert.equal(aspekSama(bad, empat), false, `${JSON.stringify(bad)} refused`)
}

// ---- akses
assert.equal(todayJakarta(new Date('2026-11-09T17:30:00Z')), '2026-11-10')
assert.equal(todayJakarta(new Date('2026-11-09T16:59:00Z')), '2026-11-09')
const def = (o: Partial<DefenseRef> = {}): DefenseRef => ({
  id: 'd1', prodi: 's1', jenis: 'prasidang', tanggal: '2026-11-10', pembimbing_kode: 'AAA', penguji_kode: 'BBB', ...o,
})
assert.equal(peranDosen(def(), 'AAA'), 'pembimbing_1')
assert.equal(peranDosen(def(), 'BBB'), 'pembimbing_2')
assert.equal(peranDosen(def(), 'CCC'), null)
assert.equal(peranDosen(def({ prodi: 's2' }), 'AAA'), null)
assert.equal(peranDosen(def({ jenis: 'sidang' }), 'AAA'), null)
assert.equal(peranDosen(def({ pembimbing_kode: null }), 'AAA'), null)
const none = new Set<Peran>()
const T = '2026-11-10'
assert.deepEqual(aksesDosen(null, 'AAA', none, T), { kind: 'tidak-ada' })
assert.deepEqual(aksesDosen(def({ prodi: 's2' }), 'AAA', none, T), { kind: 'tidak-ada' })
assert.deepEqual(aksesDosen(def({ jenis: 'sidang' }), 'AAA', none, T), { kind: 'tidak-ada' })
assert.deepEqual(aksesDosen(def(), 'CCC', none, T), { kind: 'tidak-ada' })
assert.deepEqual(aksesDosen(def(), 'AAA', none, '2026-11-09'), { kind: 'belum-dibuka', tanggal: '2026-11-10' })
assert.deepEqual(aksesDosen(def(), 'AAA', none, T), { kind: 'isi', peran: 'pembimbing_1' })
assert.deepEqual(aksesDosen(def(), 'BBB', none, '2026-12-01'), { kind: 'isi', peran: 'pembimbing_2' })
assert.deepEqual(aksesDosen(def(), 'AAA', new Set<Peran>(['pembimbing_1']), T), { kind: 'terkirim', peran: 'pembimbing_1' })
assert.deepEqual(aksesDosen(def(), 'BBB', new Set<Peran>(['pembimbing_1']), T), { kind: 'isi', peran: 'pembimbing_2' })
// a graded prasidang rescheduled later still shows the submitted grade (spec rule 5)
assert.deepEqual(aksesDosen(def({ tanggal: '2026-12-01' }), 'AAA', new Set<Peran>(['pembimbing_1']), T), { kind: 'terkirim', peran: 'pembimbing_1' })
assert.equal(bolehInputLama(def({ tanggal: '2026-10-31' }), '2026-11-01'), true)
assert.equal(bolehInputLama(def({ tanggal: '2026-11-01' }), '2026-11-01'), false)
assert.equal(bolehInputLama(def({ tanggal: '2026-11-02' }), '2026-11-01'), false)
assert.equal(bolehInputLama(def({ tanggal: '2026-10-31', prodi: 's2' }), '2026-11-01'), false)
assert.equal(bolehInputLama(def({ tanggal: '2026-10-31', jenis: 'sidang' }), '2026-11-01'), false)
assert.equal(bisaDinilai({ prodi: 's1', jenis: 'prasidang' }), true)
assert.equal(bisaDinilai({ prodi: 's2', jenis: 'prasidang' }), false)
assert.equal(bisaDinilai({ prodi: 's1', jenis: 'sidang' }), false)
assert.equal(penilaianPath('abc'), '/nilai-bimbingan/abc')
for (const p of ['/penilaian', '/atur-kata-sandi', penilaianPath('abc')]) assert.equal(halamanDosen(p), true, p)
for (const p of ['/', '/penilaian/x', '/nilai-bimbingan', '/nilai-bimbingan/', '/nilai-bimbingan/a/b', '/s1/kuliah', '/pengguna']) assert.equal(halamanDosen(p), false, p)

// ---- loadAturan
function fakeDb(rows: { kunci: string; nilai: unknown }[] | null, error: { message: string } | null = null) {
  return {
    from: (t: string) => {
      assert.equal(t, 'aturan_penilaian')
      return { select: () => ({ eq: async (c: string, v: string) => { assert.deepEqual([c, v], ['prodi', 's1']); return { data: rows, error } } }) }
    },
  } as unknown as SupabaseClient
}
async function main() {
  assert.match(DEFAULT_ATURAN.tanggalMulai, /^\d{4}-\d{2}-\d{2}$/)
  const kosong = await loadAturan(fakeDb([]), 's1')
  assert.deepEqual({ ...kosong, tanggalMulai: '' }, { ...DEFAULT_ATURAN, tanggalMulai: '' })
  assert.deepEqual((await loadAturan(fakeDb(null), 's1')).tabelNilai, tabel)
  const sebagian = await loadAturan(fakeDb([
    { kunci: 'sks_skripsi', nilai: 8 },
    { kunci: 'tanggal_mulai_penilaian', nilai: '2026-11-01' },
    { kunci: 'aspek_bimbingan', nilai: [{ label: 'X', bobot: 100, sub: ['a'] }] },
    { kunci: 'tabel_nilai', nilai: [{ min: 0, huruf: 'E', mutu: 0 }, { min: 50, huruf: 'A', mutu: 4 }] },
    { kunci: 'predikat', nilai: [{ min: 3, max: 4, predikat: 'Z', butuhTepatWaktu: true }] },
  ]), 's1')
  assert.equal(sebagian.sksSkripsi, 8)
  assert.equal(sebagian.tanggalMulai, '2026-11-01')
  assert.equal(sebagian.aspekBimbingan[0].label, 'X')
  assert.equal(sebagian.tabelNilai[0].huruf, 'A') // sorted high -> low
  assert.equal(sebagian.predikat[0].predikat, 'Z')
  const rusak = await loadAturan(fakeDb([
    { kunci: 'sks_skripsi', nilai: 'enam' },
    { kunci: 'tanggal_mulai_penilaian', nilai: '2026-13-45' },
    { kunci: 'aspek_bimbingan', nilai: [{ label: 'X', bobot: 50, sub: [] }] },
    { kunci: 'tabel_nilai', nilai: { not: 'array' } },
    { kunci: 'predikat', nilai: [{ min: 1 }] },
  ]), 's1')
  assert.equal(rusak.sksSkripsi, DEFAULT_ATURAN.sksSkripsi)
  assert.deepEqual(rusak.aspekBimbingan, DEFAULT_ATURAN.aspekBimbingan)
  assert.deepEqual(rusak.tabelNilai, tabel)
  assert.deepEqual(rusak.predikat, DEFAULT_ATURAN.predikat)
  assert.match(rusak.tanggalMulai, /^\d{4}-\d{2}-\d{2}$/)
  assert.notEqual(rusak.tanggalMulai, '2026-13-45')

  // a DB error must throw, never fall back to defaults (would freeze a default snapshot into a grade)
  await assert.rejects(loadAturan(fakeDb(null, { message: 'boom' }), 's1'), /boom/)

  // humanDbError: the dosen lock trigger and the nilai_bimbingan FK get their own wording
  const kunci = 'Dosen pembimbing tidak dapat diubah: prasidang ini sudah dinilai.'
  assert.equal(humanDbError({ code: 'P0001', message: kunci }), kunci)
  const fk = { code: '23503', message: 'update or delete on table "defenses" violates foreign key constraint "nilai_bimbingan_defense_id_fkey" on table "nilai_bimbingan"', details: 'Key (id)=(x) is still referenced from table "nilai_bimbingan".' }
  assert.equal(humanDbError(fk), 'Prasidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  assert.equal(humanDbError({ code: '23503', message: 'update or delete on table "defenses" violates foreign key constraint "nilai_bimbingan_defense_id_fkey" on table "nilai_bimbingan"' }), 'Prasidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  // deleting a graded lecturer hits nilai_bimbingan.kode_dosen: generic wording, not the prasidang one
  const fkDosen = { code: '23503', message: 'update or delete on table "lecturers" violates foreign key constraint "nilai_bimbingan_kode_dosen_fkey" on table "nilai_bimbingan"', details: 'Key (kode_dosen)=(X) is still referenced from table "nilai_bimbingan".' }
  assert.match(humanDbError(fkDosen), /masih dipakai/)
  assert.doesNotMatch(humanDbError(fkDosen), /Prasidang/)
  assert.match(humanDbError({ code: '23503', message: 'violates foreign key constraint "schedules_x"' }), /masih dipakai/) // other FKs unchanged
  assert.doesNotMatch(humanDbError({ code: 'P0001', message: 'boom' }), /boom/) // other P0001 stays hidden

  // ---- rekap: one row per prasidang, sorted by tanggal then nama; both grades -> average, one missing -> null
  const d = (id: string, tanggal: string, nama: string, p1: string | null = 'A', p2: string | null = 'B') =>
    ({ id, tanggal, npm: `n-${id}`, nama_mahasiswa: nama, judul_skripsi: `Judul ${nama}`, pembimbing_kode: p1, penguji_kode: p2 })
  const n = (defense_id: string, peran: Peran, nilai: number, sumber: 'dosen' | 'manual' = 'dosen') => ({ defense_id, peran, nilai, sumber })
  const rekap = buildRekapBimbingan(
    [d('3', '2026-11-12', 'Zed'), d('1', '2026-11-10', 'Budi'), d('2', '2026-11-10', 'Ani'), d('4', '2026-11-13', 'Cici', null, 'B')],
    [{ npm: 'n-1', sks_sebelum: 139, bobot_sebelum: 404.57 }, { npm: 'n-2', sks_sebelum: null, bobot_sebelum: null }],
    [n('1', 'pembimbing_1', 80), n('1', 'pembimbing_2', 77, 'manual'), n('2', 'pembimbing_1', 70), n('4', 'pembimbing_2', 90)],
    (k) => `Dr. ${k}`,
  )
  assert.deepEqual(rekap.map((r) => r.nama), ['Ani', 'Budi', 'Zed', 'Cici'])
  const budi = rekap[1]
  assert.equal(budi.bimbingan, 78.5)
  assert.equal(budi.ipk, 2.91)
  assert.deepEqual(budi.dospem1, { nama: 'Dr. A', nilai: 80, manual: false })
  assert.deepEqual(budi.dospem2, { nama: 'Dr. B', nilai: 77, manual: true })
  assert.equal(budi.defenseId, '1')
  assert.equal(budi.judul, 'Judul Budi')
  assert.equal(rekap[0].bimbingan, null) // only Dospem I graded
  assert.equal(rekap[0].dospem2.nilai, null)
  assert.equal(rekap[0].ipk, null) // no sks/bobot
  assert.equal(rekap[2].ipk, null) // no student row
  assert.equal(rekap[2].bimbingan, null)
  assert.equal(rekap[3].dospem1.nama, '—') // no pembimbing chosen
  assert.equal(rekap[3].bimbingan, null)

  console.log('nilai-bimbingan: all checks passed')
}

main().catch((e) => { console.error(e); process.exit(1) })
