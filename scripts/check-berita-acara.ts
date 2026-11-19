import assert from 'node:assert/strict'
import { DEFAULT_ATURAN, validateBatasHari, validatePertanyaan } from '../src/lib/penilaian/aturan'
import { aksesBeritaAcara, halamanDosen } from '../src/lib/penilaian/akses'
import { batasBeritaAcara, beritaAcaraPath, cekJawaban, gabungHasil, HASIL_LABEL, lolosGerbang, type StatusPrasidang } from '../src/lib/penilaian/prasidang'
import { statusPrasidang } from '../src/lib/penilaian/rekap-prasidang'
import { humanDbError } from '../src/lib/db-error'

// ---- combined verdict: tidak_layak > layak_revisi > layak; a missing one = belum_lengkap
assert.equal(gabungHasil('layak', 'layak'), 'layak')
assert.equal(gabungHasil('layak', 'layak_revisi'), 'layak_revisi')
assert.equal(gabungHasil('layak_revisi', 'tidak_layak'), 'tidak_layak')
assert.equal(gabungHasil('tidak_layak', 'layak'), 'tidak_layak')
assert.equal(gabungHasil('layak', null), 'belum_lengkap')
assert.equal(gabungHasil(null, null), 'belum_lengkap')
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

// ---- prasidang access: pendamping = pembimbing_kode, pembahas = penguji_kode
const p = { id: 'p', prodi: 's1', jenis: 'prasidang', tanggal: '2026-11-20', pembimbing_kode: 'A', penguji_kode: 'B' }
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(), '2026-11-19'), { kind: 'belum-dibuka', tanggal: '2026-11-20' })
assert.deepEqual(aksesBeritaAcara(p, 'B', new Set(), '2026-11-20'), { kind: 'isi', peran: 'pembahas' })
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(), '2026-11-21'), { kind: 'isi', peran: 'pendamping' })
assert.deepEqual(aksesBeritaAcara(p, 'A', new Set(['pendamping']), '2026-11-19'), { kind: 'terkirim', peran: 'pendamping' })
assert.deepEqual(aksesBeritaAcara(p, 'B', new Set(['pendamping']), '2026-11-20'), { kind: 'isi', peran: 'pembahas' })
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
]
const isi = [
  { defense_id: 'p1', peran: 'pendamping' as const, hasil: 'tidak_layak' as const },
  { defense_id: 'p2', peran: 'pendamping' as const, hasil: 'layak' as const },
  { defense_id: 'p2', peran: 'pembahas' as const, hasil: 'layak_revisi' as const },
  { defense_id: 'p3', peran: 'pendamping' as const, hasil: 'layak' as const },
  { defense_id: 'p3', peran: 'pembahas' as const, hasil: 'layak' as const },
]
assert.equal(statusPrasidang('1', pras, isi, []), 'layak_revisi', 'the latest prasidang decides')
assert.equal(statusPrasidang('2', pras, isi, []), 'tidak_ada')
assert.equal(statusPrasidang('2', pras, isi, [{ npm: '2', prasidang_id: null, hasil: 'layak' }]), 'layak', 'override with no prasidang')
assert.equal(statusPrasidang('3', pras, isi, []), 'belum_lengkap', 'same date: the later created one (p4) decides')
assert.equal(statusPrasidang('1', pras, isi, [{ npm: '1', prasidang_id: 'p1', hasil: 'layak' }]), 'layak_revisi', 'an override for an older prasidang is ignored')
assert.equal(statusPrasidang('1', pras, isi, [{ npm: '1', prasidang_id: 'p2', hasil: 'layak' }]), 'layak', 'an override for the latest wins')

// ---- DB messages written for people pass through humanDbError unchanged
for (const m of [
  'Mahasiswa belum memiliki prasidang. Super Admin dapat memberi keputusan di Data Mahasiswa.',
  'Berita acara prasidang belum lengkap.',
  'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.',
  'Dosen Pembimbing I dan II mahasiswa belum diisi di Data Mahasiswa.',
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

console.log('berita acara: all checks passed')
