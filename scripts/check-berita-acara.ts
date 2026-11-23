import assert from 'node:assert/strict'
import { DEFAULT_ATURAN, validateBatasHari, validatePertanyaan } from '../src/lib/penilaian/aturan'
import { aksesBeritaAcara, halamanDosen } from '../src/lib/penilaian/akses'
import { batasBeritaAcara, beritaAcaraPath, cekJawaban, HASIL_LABEL, lolosGerbang, type StatusPrasidang } from '../src/lib/penilaian/prasidang'
import { buildRekapPrasidang } from '../src/lib/penilaian/rekap-prasidang'
import { statusPrasidang } from '../src/lib/penilaian/rekap-prasidang'
import { humanDbError } from '../src/lib/db-error'

assert.deepEqual(
  (['layak', 'layak_revisi', 'tidak_layak', 'belum_lengkap', 'tidak_ada'] as StatusPrasidang[]).map(lolosGerbang),
  [true, true, false, false, false],
)

// ---- questions: ya_tidak (Ya/Tidak + optional catatan) and uraian (required text)
const q = DEFAULT_ATURAN.pertanyaanPrasidang
assert.deepEqual(q, [
  { teks: 'Apakah Variabel Penelitian dapat dipertahankan?', jenis: 'ya_tidak' },
  { teks: 'Apakah terdapat perubahan pertanyaan penelitian?', jenis: 'ya_tidak' },
  { teks: 'Apakah alat ukur yang diusulkan dapat digunakan untuk penelitian ini?', jenis: 'ya_tidak' },
  { teks: 'Sistematika Penulisan Proposal', jenis: 'uraian' },
  { teks: 'Substansi (isi) Proposal', jenis: 'uraian' },
])
const ya5 = [true, false, true, null, null]
const isi5 = [' a ', '', '', ' Rapi ', 'Kuat']
assert.match((cekJawaban(q, [...q, { teks: 'x', jenis: 'uraian' }], ya5, isi5) as { error: string }).error, /berubah/)
assert.match((cekJawaban(q, q.map((x, i) => (i === 3 ? { ...x, jenis: 'ya_tidak' } : x)), ya5, isi5) as { error: string }).error, /berubah/, 'a changed kind is a changed list')
assert.ok('error' in cekJawaban(q, q, [true, null, true, null, null], isi5), 'a ya_tidak needs Ya or Tidak')
assert.ok('error' in cekJawaban(q, q, ya5, [' a ', '', '', '  ', 'Kuat']), 'an uraian needs text')
assert.ok('error' in cekJawaban(q, q, ya5.slice(0, 4), isi5.slice(0, 4)))
assert.ok('error' in cekJawaban(q, q, ya5, ['', 'x'.repeat(1001), '', 'a', 'b']), 'catatan max 1000')
assert.ok('error' in cekJawaban(q, q, ya5, ['', '', '', 'x'.repeat(2001), 'b']), 'uraian max 2000')
assert.ok(!('error' in cekJawaban(q, q, ya5, ['', '', '', 'x'.repeat(2000), 'b'])))
assert.ok('error' in cekJawaban(q, q, 'x', isi5))
assert.deepEqual(cekJawaban(q, q, [true, false, true, true, false], isi5), {
  jawaban: [
    { teks: q[0].teks, jenis: 'ya_tidak', ya: true, catatan: 'a' },
    { teks: q[1].teks, jenis: 'ya_tidak', ya: false, catatan: '' },
    { teks: q[2].teks, jenis: 'ya_tidak', ya: true, catatan: '' },
    { teks: q[3].teks, jenis: 'uraian', ya: null, catatan: 'Rapi' }, // an uraian never stores a Ya/Tidak
    { teks: q[4].teks, jenis: 'uraian', ya: null, catatan: 'Kuat' },
  ],
})
assert.notEqual(validatePertanyaan([]), null)
assert.notEqual(validatePertanyaan([{ teks: ' ', jenis: 'uraian' }]), null)
assert.notEqual(validatePertanyaan([{ teks: 'A', jenis: 'lain' as 'uraian' }]), null)
assert.equal(validatePertanyaan(q), null)
assert.equal(HASIL_LABEL.tidak_layak, 'Skripsi tidak layak untuk dilanjutkan (Mahasiswa diharapkan mengganti topik atau variabel penelitian)')
// Shown, not enforced: the faculty asks for it by the day after the prasidang.
assert.equal(batasBeritaAcara('2026-11-30'), '2026-12-01')
assert.equal(batasBeritaAcara('2026-12-31'), '2027-01-01')
assert.equal(validateBatasHari(7), null)
assert.equal(validateBatasHari(60), null)
assert.notEqual(validateBatasHari(0), null)
assert.notEqual(validateBatasHari(61), null)
assert.notEqual(validateBatasHari(2.5), null)
assert.equal(DEFAULT_ATURAN.batasHariBimbingan, 7)

// ---- prasidang access: only the Pembimbing Pendamping (pembimbing_kode) fills; the Pembahas (penguji_kode) does not
const p = { id: 'p', prodi: 's1', jenis: 'prasidang', tanggal: '2026-11-20', pembimbing_kode: 'A', penguji_kode: 'B' }
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(), '2026-11-19'), { kind: 'belum-dibuka', tanggal: '2026-11-20' })
assert.deepEqual(aksesBeritaAcara(p, 'B', new Set(), '2026-11-20'), { kind: 'tidak-ada' }, 'pembahas does not fill')
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(), '2026-11-21'), { kind: 'isi', peran: 'pendamping' })
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(['pendamping']), '2026-11-19'), { kind: 'terkirim', peran: 'pendamping' })
assert.deepEqual(aksesBeritaAcara(p, 'B', new Set(['pendamping']), '2026-11-20'), { kind: 'tidak-ada' })
assert.deepEqual(aksesBeritaAcara(p, 'C', new Set(), '2026-11-20'), { kind: 'tidak-ada' })
assert.deepEqual(aksesBeritaAcara(null, 'A', new Set(), '2026-11-20'), { kind: 'tidak-ada' })
assert.deepEqual(aksesBeritaAcara({ ...p, jenis: 'sidang' }, 'A', new Set(), '2026-11-20'), { kind: 'tidak-ada' })
assert.deepEqual(aksesBeritaAcara({ ...p, prodi: 's2' }, 'A', new Set(), '2026-11-20'), { kind: 'tidak-ada' })
assert.equal(beritaAcaraPath('abc'), '/berita-acara-prasidang/abc')
assert.ok(halamanDosen('/berita-acara-prasidang/x'))
assert.ok(!halamanDosen('/berita-acara-prasidang/x', 'EKSTERNAL'))
assert.ok(!halamanDosen('/berita-acara-prasidang/x/y'))

// ---- statusPrasidang mirrors status_prasidang() in the DB
const pras = [
  { id: 'p1', npm: '1', tanggal: '2026-10-01', created_at: '2026-09-01T00:00:00Z' },
  { id: 'p2', npm: '1', tanggal: '2026-11-01', created_at: '2026-09-02T00:00:00Z' },
  { id: 'p3', npm: '3', tanggal: '2026-11-01', created_at: '2026-09-01T00:00:00Z' },
  { id: 'p4', npm: '3', tanggal: '2026-11-01', created_at: '2026-09-05T00:00:00Z' },
  { id: 'p5', npm: '5', tanggal: '2026-11-01', created_at: '2026-09-01T00:00:00Z' },
]
const isi = [
  { defense_id: 'p1', peran: 'pendamping' as const, hasil: 'tidak_layak' as const },
  { defense_id: 'p2', peran: 'pendamping' as const, hasil: 'layak' as const },
  { defense_id: 'p2', peran: 'pembahas' as const, hasil: 'layak_revisi' as const },
  { defense_id: 'p3', peran: 'pendamping' as const, hasil: 'layak' as const },
  { defense_id: 'p3', peran: 'pembahas' as const, hasil: 'layak' as const },
  { defense_id: 'p5', peran: 'pembahas' as const, hasil: 'layak' as const }, // filled before the pendamping-only rule
]
assert.equal(statusPrasidang('1', pras, isi, []), 'layak', 'the latest prasidang decides; its pendamping alone, an old pembahas row is ignored')
assert.equal(statusPrasidang('5', pras, isi, []), 'belum_lengkap', 'a pembahas row alone is not a verdict')
assert.equal(statusPrasidang('2', pras, isi, []), 'tidak_ada')
assert.equal(statusPrasidang('2', pras, isi, [{ npm: '2', prasidang_id: null, hasil: 'layak' }]), 'layak', 'override with no prasidang')
assert.equal(statusPrasidang('3', pras, isi, []), 'belum_lengkap', 'same date: the later created one (p4) decides')
assert.equal(statusPrasidang('1', pras, isi, [{ npm: '1', prasidang_id: 'p1', hasil: 'layak_revisi' }]), 'layak', 'an override for an older prasidang is ignored')
assert.equal(statusPrasidang('1', pras, isi, [{ npm: '1', prasidang_id: 'p2', hasil: 'layak_revisi' }]), 'layak_revisi', 'an override for the latest wins')
const rekap = buildRekapPrasidang(pras.map((x) => ({ ...x, nama_mahasiswa: '', judul_skripsi: '' })), isi, [], new Set())
assert.deepEqual(rekap.map((r) => r.status), ['tidak_layak', 'layak', 'layak', 'belum_lengkap', 'belum_lengkap'], 'rekap: each prasidang by its pendamping')
// Email status comes from the Pendamping's row only; no row (or no status selected) = null.
const rekapEmail = buildRekapPrasidang([{ ...pras[0], nama_mahasiswa: '', judul_skripsi: '' }], [
  { defense_id: pras[0].id, peran: 'pembahas', hasil: 'layak', email_status: 'terkirim' },
  { defense_id: pras[0].id, peran: 'pendamping', hasil: 'layak', email_status: 'sebagian', email_detail: [{ alamat: 'x@up.id', status: 'gagal', alasan: 'y' }, 'rusak'], submitted_at: '2026-11-23T01:00:00Z' },
], [], new Set())
assert.deepEqual(rekapEmail[0].email, { status: 'sebagian', detail: [{ alamat: 'x@up.id', status: 'gagal', alasan: 'y' }], submittedAt: '2026-11-23T01:00:00Z' })
assert.equal(rekap[3].email, null)

// ---- DB messages written for people pass through humanDbError unchanged
for (const m of [
  'Mahasiswa belum memiliki prasidang. Super Admin dapat memberi keputusan di Data Mahasiswa.',
  'Berita acara prasidang belum lengkap.',
  'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.',
  'Dosen Pembimbing mahasiswa belum lengkap di Data Mahasiswa.',
  'Dosen Pembimbing untuk peran ini belum diisi di Data Mahasiswa.',
  'Nilai bimbingan hanya untuk sidang S1.',
]) assert.equal(humanDbError({ code: '23514', message: m }), m, m)
for (const m of [
  'Mahasiswa tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Tanggal tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Dosen pembimbing tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Dosen pembimbing tidak dapat diubah: nilai bimbingan sudah dikirim.',
  'Dosen eksternal tidak dapat menjadi Dosen Pembimbing.',
]) assert.equal(humanDbError({ code: 'P0001', message: m }), m, m)
assert.doesNotMatch(humanDbError({ code: '23514', message: 'new row violates check constraint "x"' }), /constraint/)
assert.equal(
  humanDbError({ code: '23503', message: 'update or delete on table "defenses" violates foreign key constraint "berita_acara_prasidang_defense_id_fkey" on table "berita_acara_prasidang"' }),
  'Prasidang ini sudah diisi berita acaranya, sehingga tidak bisa dihapus.',
)

// ---- deleting a dosen still in use: say what holds it (each table that references lecturers)
const hapusDosen = (c: string, t: string) =>
  humanDbError({ code: '23503', message: `update or delete on table "lecturers" violates foreign key constraint "${c}" on table "${t}"` })
assert.match(hapusDosen('students_pembimbing_1_kode_fkey', 'students'), /Dosen Pembimbing mahasiswa di Data Mahasiswa/)
assert.match(hapusDosen('students_pembimbing_2_kode_fkey', 'students'), /Dosen Pembimbing mahasiswa di Data Mahasiswa/)
assert.match(hapusDosen('defenses_penguji_kode_fkey', 'defenses'), /jadwal prasidang\/sidang/)
assert.match(hapusDosen('profiles_kode_dosen_fkey', 'profiles'), /akun pengguna/)
assert.match(hapusDosen('akun_eksternal_kode_dosen_fkey', 'akun_eksternal'), /akun penguji eksternal/)
for (const t of ['nilai_bimbingan', 'nilai_sidang', 'berita_acara_prasidang']) assert.match(hapusDosen(`${t}_kode_dosen_fkey`, t), /sudah mengisi nilai atau berita acara/, t)
// The same constraint on an insert (an unknown kode on a student) is not a dosen delete.
assert.equal(
  humanDbError({ code: '23503', message: 'insert or update on table "students" violates foreign key constraint "students_pembimbing_1_kode_fkey"' }),
  'Data ini masih dipakai oleh data lain, sehingga tidak bisa dihapus atau diubah.',
)

// ---- printed berita acara: the faculty's layout and file name (BA Prasidang sample, 2026-11-23)
void (async () => {
  const ExcelJS = (await import('exceljs')).default
  const { buildBeritaAcaraPrasidangXlsx, namaBeritaAcaraPrasidang } = await import('../src/lib/penilaian/berita-acara-prasidang-xlsx')
  const defense = { id: 'x', prodi: 's1', jenis: 'prasidang', tanggal: '2026-11-23', npm: '6022210049', nama_mahasiswa: 'Fadel Ayafa Diraja', judul_skripsi: 'Judul', pembimbing_kode: 'A', penguji_kode: 'B' }
  const ya = [true, false, true, null, null]
  const cat = ['', '', 'Perhatikan dimensi', 'Ikuti perbaikan', '1. Satu\n2. Dua']
  const ba = {
    defense, academicYearId: '20261', status: 'layak_revisi', keputusan: null, aturan: DEFAULT_ATURAN,
    dosen: { pendamping: 'Endro, M.Psi.', pembahas: 'Aully, M.Si.' },
    isian: { pendamping: { id: 'r', peran: 'pendamping', kode_dosen: 'A', hasil: 'layak_revisi', submitted_at: '2026-11-23T05:00:00Z', email_status: 'terkirim',
      jawaban: q.map((x, i) => ({ teks: x.teks, jenis: x.jenis, ya: ya[i], catatan: cat[i] })) } },
  } as unknown as Parameters<typeof buildBeritaAcaraPrasidangXlsx>[0]
  assert.equal(namaBeritaAcaraPrasidang(ba), 'BA Prasidang Gasal 2026-2027- Fadel Ayafa Diraja')
  assert.equal(namaBeritaAcaraPrasidang({ ...ba, academicYearId: '20252' }), 'BA Prasidang Genap 2025-2026- Fadel Ayafa Diraja')

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await buildBeritaAcaraPrasidangXlsx(ba, { kop: ['FAKULTAS PSIKOLOGI', 'Gedung F'], jabatan: 'KETUA PROGRAM STUDI', nama: 'FARIDA AINI', gambarTandaTangan: '' })).buffer as ArrayBuffer)
  const ws = wb.worksheets[0]
  assert.equal(ws.pageSetup.orientation, 'landscape')
  const baris = Array.from(ws.getSheetValues().slice(1), (r) => (Array.isArray(r) ? Array.from(r.slice(1), (v) => v ?? '') : []))
  const cari = (label: string) => baris.find((r) => r[0] === label)?.[2]
  assert.ok(baris.some((r) => r[0] === 'PRASIDANG SKRIPSI SEMESTER GASAL 2026/2027'))
  assert.equal(cari('HARI, TANGGAL'), 'Senin, 23 November 2026')
  assert.equal(cari('SEKRETARIS SIDANG'), 'Endro, M.Psi.')
  assert.equal(cari('DOSEN PEMBAHAS'), 'Aully, M.Si.')
  assert.equal(cari('SUBSTANSI (ISI) PROPOSAL'), '1. Satu\n2. Dua')
  assert.equal(cari('BERDASARKAN HASIL PRASIDANG, MAKA PROPOSAL SKRIPSI INI'), HASIL_LABEL.layak_revisi)
  assert.equal(cari(q[0].teks.toUpperCase()), 'Ya')
  assert.equal(cari(q[2].teks.toUpperCase()), 'Ya/Perhatikan dimensi')
  // Order: Saran (uraian) before the verdict, Ya/Tidak after it; signed by the Kaprodi at the end.
  const idx = (t: string) => baris.findIndex((r) => r[0] === t || r[2] === t)
  assert.ok(idx('SARAN DAN PERBAIKAN PROPOSAL SKRIPSI') < idx('SISTEMATIKA PENULISAN PROPOSAL'))
  assert.ok(idx('SUBSTANSI (ISI) PROPOSAL') < idx('BERDASARKAN HASIL PRASIDANG, MAKA PROPOSAL SKRIPSI INI'))
  assert.ok(idx('BERDASARKAN HASIL PRASIDANG, MAKA PROPOSAL SKRIPSI INI') < idx(q[0].teks.toUpperCase()))
  assert.ok(idx('KETUA PROGRAM STUDI') < idx('FARIDA AINI') && idx('FARIDA AINI') === baris.length - 1)
  console.log('berita acara: all checks passed')
})()
