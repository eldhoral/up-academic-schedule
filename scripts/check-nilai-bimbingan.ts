import assert from 'node:assert/strict'
import { humanDbError } from '../src/lib/db-error'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_ATURAN, loadAturan, validateAspek, validatePredikat, validateSks, validateTabelNilai,
} from '../src/lib/penilaian/aturan'
import { aksesBimbingan, batasBimbingan, halamanDosen, penilaianPath, peranBimbingan, todayJakarta, type BimbinganRef, type Peran } from '../src/lib/penilaian/akses'
import { buildRekapBimbingan } from '../src/lib/penilaian/rekap'
import { buildRekapBimbinganXlsx } from '../src/lib/penilaian/rekap-xlsx'
import ExcelJS from 'exceljs'
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
assert.equal(nilaiBimbingan(80, null, true), 80) // tanpa Pembimbing II: Pembimbing I alone
assert.equal(nilaiBimbingan(80.005, null, true), 80.01)
assert.equal(nilaiBimbingan(null, null, true), null)
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

// ---- akses (bimbingan: S1 and S2 sidang, the student's Pembimbing I/II, after the Ketua's lulus lock, n days)
assert.equal(todayJakarta(new Date('2026-11-09T17:30:00Z')), '2026-11-10')
assert.equal(todayJakarta(new Date('2026-11-09T16:59:00Z')), '2026-11-09')
const s: BimbinganRef = { id: 's', prodi: 's1', jenis: 'sidang', pembimbing_1_kode: 'P1', pembimbing_2_kode: 'P2' }
assert.equal(peranBimbingan(s, 'P1'), 'pembimbing_1')
assert.equal(peranBimbingan(s, 'P2'), 'pembimbing_2')
assert.equal(peranBimbingan(s, 'X'), null)
assert.equal(peranBimbingan({ ...s, prodi: 's2' }, 'P1'), 'pembimbing_1', 'S2 sidang tesis takes a Nilai Bimbingan too (kiprat 2026-11-27)')
assert.equal(peranBimbingan({ ...s, jenis: 'prasidang' }, 'P1'), null)
assert.equal(peranBimbingan({ ...s, pembimbing_1_kode: null }, 'P1'), null)
// 17:30 UTC on 10 Nov = 00:30 on 11 Nov in Jakarta: day 0 is 11 Nov
const kunci = { lockedAt: '2026-11-10T17:30:00Z', lulus: true }
assert.equal(batasBimbingan(kunci.lockedAt, 7), '2026-11-18')
assert.equal(batasBimbingan('2026-12-28T10:00:00Z', 7), '2027-01-04')
const o = (x: Partial<Parameters<typeof aksesBimbingan>[2]> = {}) => ({ submitted: new Set<Peran>(), kunci, today: '2026-11-12', batasHari: 7, ...x })
assert.deepEqual(aksesBimbingan(s, 'P2', o()), { kind: 'isi', peran: 'pembimbing_2', batas: '2026-11-18' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ today: '2026-11-11' })), { kind: 'isi', peran: 'pembimbing_1', batas: '2026-11-18' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ today: '2026-11-18' })), { kind: 'isi', peran: 'pembimbing_1', batas: '2026-11-18' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ today: '2026-11-19' })), { kind: 'lewat', batas: '2026-11-18' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ kunci: null })), { kind: 'menunggu-kunci' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ kunci: { ...kunci, lulus: false } })), { kind: 'tidak-lulus' })
assert.deepEqual(aksesBimbingan(s, 'P1', o({ today: '2027-01-01', submitted: new Set<Peran>(['pembimbing_1']) })), { kind: 'terkirim', peran: 'pembimbing_1' })
assert.deepEqual(aksesBimbingan(s, 'P2', o({ submitted: new Set<Peran>(['pembimbing_1']) })), { kind: 'isi', peran: 'pembimbing_2', batas: '2026-11-18' })
assert.deepEqual(aksesBimbingan(s, 'X', o()), { kind: 'tidak-ada' })
assert.deepEqual(aksesBimbingan(null, 'P1', o()), { kind: 'tidak-ada' })
assert.deepEqual(aksesBimbingan({ ...s, jenis: 'prasidang' }, 'P1', o()), { kind: 'tidak-ada' })
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
    { kunci: 'pertanyaan_prasidang', nilai: [{ teks: 'Q1', jenis: 'ya_tidak' }, { teks: 'Q2', jenis: 'uraian' }] },
    { kunci: 'batas_hari_bimbingan', nilai: 14 },
  ]), 's1')
  assert.deepEqual(sebagian.pertanyaanPrasidang, [{ teks: 'Q1', jenis: 'ya_tidak' }, { teks: 'Q2', jenis: 'uraian' }])
  assert.equal(sebagian.batasHariBimbingan, 14)
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
    { kunci: 'pertanyaan_prasidang', nilai: ['bukan objek'] },
    { kunci: 'batas_hari_bimbingan', nilai: 0 },
  ]), 's1')
  assert.deepEqual(rusak.pertanyaanPrasidang, DEFAULT_ATURAN.pertanyaanPrasidang)
  assert.equal(rusak.batasHariBimbingan, 7)
  assert.equal(rusak.sksSkripsi, DEFAULT_ATURAN.sksSkripsi)
  assert.deepEqual(rusak.aspekBimbingan, DEFAULT_ATURAN.aspekBimbingan)
  assert.deepEqual(rusak.tabelNilai, tabel)
  assert.deepEqual(rusak.predikat, DEFAULT_ATURAN.predikat)
  assert.match(rusak.tanggalMulai, /^\d{4}-\d{2}-\d{2}$/)
  assert.notEqual(rusak.tanggalMulai, '2026-13-45')

  // a DB error must throw, never fall back to defaults (would freeze a default snapshot into a grade)
  await assert.rejects(loadAturan(fakeDb(null, { message: 'boom' }), 's1'), /boom/)

  // humanDbError: the dosen lock trigger and the nilai_bimbingan FK get their own wording
  const fk = { code: '23503', message: 'update or delete on table "defenses" violates foreign key constraint "nilai_bimbingan_defense_id_fkey" on table "nilai_bimbingan"', details: 'Key (id)=(x) is still referenced from table "nilai_bimbingan".' }
  assert.equal(humanDbError(fk), 'Sidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  // deleting a graded lecturer hits nilai_bimbingan.kode_dosen: the dosen wording, not the sidang one
  const fkDosen = { code: '23503', message: 'update or delete on table "lecturers" violates foreign key constraint "nilai_bimbingan_kode_dosen_fkey" on table "nilai_bimbingan"', details: 'Key (kode_dosen)=(X) is still referenced from table "nilai_bimbingan".' }
  assert.match(humanDbError(fkDosen), /Dosen ini sudah mengisi nilai/)
  assert.doesNotMatch(humanDbError(fkDosen), /Sidang/)
  assert.match(humanDbError({ code: '23503', message: 'violates foreign key constraint "schedules_x"' }), /masih dipakai/) // other FKs unchanged
  assert.doesNotMatch(humanDbError({ code: 'P0001', message: 'boom' }), /boom/) // other P0001 stays hidden

  // ---- rekap: one row per S1 sidang, sorted by tanggal then nama; dosen from the student's Pembimbing I/II;
  // both grades -> average, one missing -> null; batas = lock date + n while locked.
  const d = (id: string, tanggal: string, nama: string) => ({ id, tanggal, npm: `n-${id}`, nama_mahasiswa: nama, judul_skripsi: `Judul ${nama}` })
  const mhs = (id: string, p1: string | null, p2: string | null, sks: number | null = null, bobot: number | null = null, tanpa = false) =>
    ({ npm: `n-${id}`, sks_sebelum: sks, bobot_sebelum: bobot, pembimbing_1_kode: p1, pembimbing_2_kode: p2, tanpa_pembimbing_2: tanpa })
  const n = (defense_id: string, peran: Peran, nilai: number, sumber: 'dosen' | 'manual' = 'dosen') => ({ defense_id, peran, nilai, sumber })
  const rekap = buildRekapBimbingan(
    [d('2', '2026-11-10', 'Ani'), d('1', '2026-11-10', 'Budi'), d('3', '2026-11-12', 'Zed'), d('4', '2026-11-13', 'Cici')],
    [mhs('1', 'A', 'B', 139, 404.57), mhs('2', 'A', 'B'), mhs('4', null, 'B')],
    [n('1', 'pembimbing_1', 80), n('1', 'pembimbing_2', 77, 'manual'), n('2', 'pembimbing_1', 70), n('4', 'pembimbing_2', 90)],
    [{ defense_id: '1', locked_at: '2026-11-10T03:00:00Z' }],
    7,
    (k) => `Dr. ${k}`,
  )
  assert.deepEqual(rekap.map((r) => r.nama), ['Ani', 'Budi', 'Zed', 'Cici']) // as given: the SQL query sorts
  const budi = rekap[1]
  assert.equal(budi.bimbingan, 78.5)
  assert.equal(budi.ipk, 2.91)
  assert.deepEqual(budi.dospem1, { nama: 'Dr. A', nilai: 80, manual: false })
  assert.deepEqual(budi.dospem2, { nama: 'Dr. B', nilai: 77, manual: true })
  assert.equal(budi.defenseId, '1')
  assert.equal(budi.judul, 'Judul Budi')
  assert.equal(budi.batas, '2026-11-17')
  assert.equal(rekap[0].batas, null) // not locked
  assert.equal(rekap[0].bimbingan, null) // only Dospem I graded
  assert.equal(rekap[0].dospem2.nilai, null)
  assert.equal(rekap[0].ipk, null) // no sks/bobot
  assert.equal(rekap[2].ipk, null) // no student row
  assert.equal(rekap[2].dospem1.nama, '—') // no student row, no pembimbing
  assert.equal(rekap[2].bimbingan, null)
  assert.equal(rekap[3].dospem1.nama, '—') // no Pembimbing I set
  assert.equal(rekap[3].bimbingan, null)
  assert.equal(budi.tanpaP2, false)

  // Tanpa Pembimbing II: Nilai Bimbingan is Pembimbing I's grade; the Pembimbing II cell says so.
  const [solo] = buildRekapBimbingan([d('5', '2026-11-14', 'Dedi')], [mhs('5', 'A', null, null, null, true)],
    [n('5', 'pembimbing_1', 82)], [], 7, (k) => `Dr. ${k}`)
  assert.equal(solo.tanpaP2, true)
  assert.equal(solo.bimbingan, 82)
  assert.deepEqual(solo.dospem2, { nama: 'Tidak ada', nilai: null, manual: false })

  // The Excel recap marks a manual grade on the dosen name; the grade cell stays a number.
  const xlsx = new ExcelJS.Workbook()
  await xlsx.xlsx.load((await buildRekapBimbinganXlsx([budi], tabel)).buffer)
  const sel = xlsx.getWorksheet('Nilai Bimbingan')!.getRow(2)
  assert.equal(sel.getCell(6).value, 'Dr. A')
  assert.equal(sel.getCell(9).value, 'Dr. B (input admin)')
  assert.equal(sel.getCell(10).value, 77)

  console.log('nilai-bimbingan: all checks passed')
}

main().catch((e) => { console.error(e); process.exit(1) })
