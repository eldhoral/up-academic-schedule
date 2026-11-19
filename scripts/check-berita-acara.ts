import assert from 'node:assert/strict'
import { DEFAULT_ATURAN, validateBatasHari, validatePertanyaan } from '../src/lib/penilaian/aturan'
import { aksesBeritaAcara, halamanDosen } from '../src/lib/penilaian/akses'
import { beritaAcaraPath, cekJawaban, gabungHasil, lolosGerbang, type StatusPrasidang } from '../src/lib/penilaian/prasidang'
import { statusPrasidang } from '../src/lib/penilaian/rekap-prasidang'

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

// ---- questions
const q = DEFAULT_ATURAN.pertanyaanPrasidang
assert.equal(q.length, 3)
assert.equal(q[0], 'Apakah Variabel Penelitian dapat dipertahankan?')
assert.equal(q[1], 'Apakah terdapat perubahan pertanyaan penelitian?')
assert.equal(q[2], 'Apakah alat ukur yang diusulkan dapat digunakan untuk penelitian ini?')
assert.match((cekJawaban(q, [...q, 'x'], [true, true, true], ['', '', '']) as { error: string }).error, /berubah/)
assert.ok('error' in cekJawaban(q, q, [true, null, true], ['', '', '']))
assert.ok('error' in cekJawaban(q, q, [true, true], ['', '']))
assert.ok('error' in cekJawaban(q, q, [true, true, true], ['', 'x'.repeat(1001), '']))
assert.ok('error' in cekJawaban(q, q, 'x', ['', '', '']))
assert.deepEqual(cekJawaban(q, q, [true, false, true], [' a ', '', '']), {
  jawaban: [{ teks: q[0], ya: true, catatan: 'a' }, { teks: q[1], ya: false, catatan: '' }, { teks: q[2], ya: true, catatan: '' }],
})
assert.notEqual(validatePertanyaan([]), null)
assert.notEqual(validatePertanyaan([' ']), null)
assert.equal(validatePertanyaan(q), null)
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

console.log('berita acara: all checks passed')
