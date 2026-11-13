import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_ATURAN, bekukan, loadAturan, parseAturanBeku, validateAspek, validatePilihanYudisium, type AturanBeku,
} from '../src/lib/penilaian/aturan'
import { humanDbError } from '../src/lib/db-error'
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

// ---- akses sidang
import {
  aksesSidang, bisaDinilaiSidang, eksternalAktif, halamanDosen, penilaianSidangPath, peranPenguji, type PeranSidang, type SidangRef,
} from '../src/lib/penilaian/akses'
{
  const sd: SidangRef = { id: 's1', prodi: 's1', jenis: 'sidang', tanggal: '2026-11-10', pembimbing_kode: 'PB', penguji_kode: 'KT', penguji_eksternal_kode: 'EX' }
  const none = new Set<PeranSidang>()
  const o = (p: Partial<Parameters<typeof aksesSidang>[2]> = {}) => ({ submitted: none, locked: false, today: '2026-11-10', ...p })

  assert.equal(bisaDinilaiSidang(sd), true)
  assert.equal(bisaDinilaiSidang({ ...sd, prodi: 's2' }), false)
  assert.equal(bisaDinilaiSidang({ ...sd, jenis: 'prasidang' }), false)
  assert.equal(peranPenguji(sd, 'KT'), 'ketua')
  assert.equal(peranPenguji(sd, 'EX'), 'anggota_1')
  assert.equal(peranPenguji(sd, 'PB'), 'anggota_2')
  assert.equal(peranPenguji(sd, 'ZZ'), null)
  assert.equal(peranPenguji({ ...sd, prodi: 's2' }, 'KT'), null)
  assert.equal(peranPenguji({ ...sd, jenis: 'prasidang' }, 'KT'), null)
  assert.equal(peranPenguji({ ...sd, penguji_eksternal_kode: null }, ''), null)

  assert.deepEqual(aksesSidang(null, 'KT', o()), { kind: 'tidak-ada' })
  assert.deepEqual(aksesSidang(sd, 'ZZ', o()), { kind: 'tidak-ada' })
  assert.deepEqual(aksesSidang(sd, 'EX', o({ today: '2026-11-09' })), { kind: 'belum-dibuka', tanggal: '2026-11-10' })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ today: '2026-11-09' })), { kind: 'belum-dibuka', tanggal: '2026-11-10' })
  assert.deepEqual(aksesSidang(sd, 'EX', o()), { kind: 'isi', peran: 'anggota_1' })
  assert.deepEqual(aksesSidang(sd, 'PB', o({ today: '2026-11-11' })), { kind: 'isi', peran: 'anggota_2' })
  // Submitted wins over the date gate (a rescheduled graded sidang stays read-only).
  assert.deepEqual(aksesSidang(sd, 'EX', o({ submitted: new Set(['anggota_1']), today: '2026-11-01' })), { kind: 'terkirim', peran: 'anggota_1' })
  // Ketua waits for both anggota and is told who is missing.
  assert.deepEqual(aksesSidang(sd, 'KT', o()), { kind: 'menunggu-anggota', kurang: ['anggota_1', 'anggota_2'] })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['anggota_2']) })), { kind: 'menunggu-anggota', kurang: ['anggota_1'] })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['anggota_1', 'anggota_2']) })), { kind: 'kunci', peran: 'ketua' })
  // After the lock everyone is read-only, even before the date gate.
  const dua = new Set<PeranSidang>(['anggota_1', 'anggota_2', 'ketua'])
  for (const kode of ['KT', 'EX', 'PB']) {
    assert.deepEqual(aksesSidang(sd, kode, o({ submitted: dua, locked: true })), { kind: 'terkunci' })
    assert.deepEqual(aksesSidang(sd, kode, o({ submitted: dua, locked: true, today: '2026-01-01' })), { kind: 'terkunci' })
  }
  // An EKSTERNAL account is bound to its day.
  assert.deepEqual(aksesSidang(sd, 'EX', o({ akunTanggal: '2026-11-10' })), { kind: 'isi', peran: 'anggota_1' })
  assert.deepEqual(aksesSidang(sd, 'EX', o({ akunTanggal: '2026-11-09' })), { kind: 'tidak-ada' })
  assert.deepEqual(aksesSidang(sd, 'EX', o({ akunTanggal: '2026-11-09', locked: true })), { kind: 'tidak-ada' })
  assert.deepEqual(aksesSidang({ ...sd, prodi: 's2' }, 'KT', o()), { kind: 'tidak-ada' })

  // Jakarta day: valid through berlaku_sampai, gone at 00:00 WIB the next day.
  assert.equal(eksternalAktif('2026-11-10', new Date('2026-11-10T16:59:00Z')), true)
  assert.equal(eksternalAktif('2026-11-10', new Date('2026-11-10T17:00:00Z')), false)

  assert.equal(penilaianSidangPath('abc'), '/nilai-sidang/abc')
  // A DOSEN gains the sidang page, an EKSTERNAL gets the sidang page but no password page or bimbingan.
  for (const p of ['/penilaian', '/atur-kata-sandi', '/nilai-bimbingan/abc', '/nilai-sidang/abc']) assert.equal(halamanDosen(p, 'DOSEN'), true, p)
  for (const p of ['/penilaian', '/nilai-sidang/abc']) assert.equal(halamanDosen(p, 'EKSTERNAL'), true, p)
  for (const p of ['/atur-kata-sandi', '/nilai-bimbingan/abc', '/', '/nilai-sidang', '/nilai-sidang/a/b', '/s1/kuliah']) assert.equal(halamanDosen(p, 'EKSTERNAL'), false, p)
  for (const p of ['/nilai-sidang', '/nilai-sidang/a/b']) assert.equal(halamanDosen(p, 'DOSEN'), false, p)
  console.log('nilai-sidang akses: all checks passed')
}

// ---- akun penguji eksternal
import { emailLogin, ensureAkunEksternal, passwordAcak, usernameEksternal } from '../src/lib/penilaian/akun-eksternal'
{
  assert.equal(usernameEksternal('EXT-01', '2026-11-20'), 'eks-ext01-201126')
  assert.equal(usernameEksternal('ab_C 9', '2027-01-05'), 'eks-abc9-050127')
  let seed = 42
  const seeded = (n: number) => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n
  for (let i = 0; i < 50; i++) {
    const p = passwordAcak(10, seeded)
    assert.equal(p.length, 10)
    assert.ok(!/[0O1lI]/.test(p), p)
  }
  assert.equal(passwordAcak().length, 10)
  assert.equal(emailLogin('eks-x-1'), 'eks-x-1@penguji.local')
  assert.equal(emailLogin('a@b.id'), 'a@b.id')
}

// ensureAkunEksternal against a recording fake of the admin client.
type Hasil = { data?: unknown; error?: { message: string; code?: string } | null }
function fakeAdmin(r: { ada?: Hasil; create?: Hasil; profil?: Hasil; insert?: Hasil; hapus?: Hasil; pemilik?: Hasil }) {
  const log: string[] = []
  const chain = (nama: string, hasil: Hasil = {}) => {
    type Chain = Record<string, (...a: unknown[]) => unknown>
    const c: Chain = {}
    for (const m of ['select', 'eq', 'lt', 'update', 'insert']) c[m] = (...a) => { log.push(`${nama}.${m}(${a.map((x) => JSON.stringify(x)).join(',')})`); return c }
    c.maybeSingle = async () => ({ data: null, error: null, ...hasil })
    c.then = (ok) => (ok as (v: unknown) => void)({ data: null, error: null, ...hasil })
    return c
  }
  const admin = {
    from: (t: string) => ({
      select: (s: string) => (s === 'kode_dosen' ? chain(`${t}:pemilik`, r.pemilik) : chain(t, r.ada)).select(s),
      update: (v: unknown) => chain(t, r.profil).update(v),
      insert: (v: unknown) => chain(t, r.insert).insert(v),
    }),
    auth: { admin: {
      createUser: async (v: { email: string }) => { log.push(`createUser(${v.email})`); return { data: { user: { id: 'u-baru' } }, error: null, ...r.create } },
      deleteUser: async (id: string) => { log.push(`deleteUser(${id})`); return { data: null, error: null, ...r.hapus } },
    } },
  }
  return { admin: admin as unknown as SupabaseClient, log }
}
async function cekEnsure() {
  // New: one profile update with role + kode + berlaku_sampai = tanggal + 1, then the akun row.
  {
    const { admin, log } = fakeAdmin({})
    const res = await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14')
    assert.ok(res.created && res.username === 'eks-ext01-201126' && res.password.length === 10)
    assert.ok(log.includes('createUser(eks-ext01-201126@penguji.local)'), log.join('\n'))
    assert.ok(log.some((l) => l.startsWith('profiles.update(') && l.includes('"role":"EKSTERNAL"') && l.includes('"kode_dosen":"EXT-01"') && l.includes('"berlaku_sampai":"2026-11-21"')), log.join('\n'))
    assert.ok(log.some((l) => l.startsWith('akun_eksternal.insert(') && l.includes('"username":"eks-ext01-201126"')), log.join('\n'))
    assert.ok(!log.some((l) => l.startsWith('deleteUser')))
  }
  // Exists: no new user, berlaku_sampai only ever raised to tanggal + 1.
  {
    const { admin, log } = fakeAdmin({ ada: { data: { user_id: 'u-lama' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), { created: false })
    assert.ok(!log.some((l) => l.startsWith('createUser')))
    assert.ok(log.includes('profiles.lt("berlaku_sampai","2026-11-21")'), log.join('\n'))
  }
  // Profile update fails: the VIEWER user is deleted, the error surfaces.
  {
    const { admin, log } = fakeAdmin({ profil: { error: { message: 'boom' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'))
    assert.ok(log.includes('deleteUser(u-baru)'))
  }
  // ...and a failed delete is reported too, naming the leftover login.
  {
    const { admin } = fakeAdmin({ profil: { error: { message: 'boom' } }, hapus: { error: { message: 'down' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), /eks-ext01-201126/)
  }
  // Race lost on the akun row (23505): clean up our user, treat as existing.
  {
    const { admin, log } = fakeAdmin({ insert: { error: { message: 'dup', code: '23505' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), { created: false })
    assert.ok(log.includes('deleteUser(u-baru)'))
  }
  // Race lost on the login itself (same username): nothing to clean up, treat as existing.
  {
    const { admin, log } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } }, pemilik: { data: { kode_dosen: 'EXT-01' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), { created: false })
    assert.ok(!log.some((l) => l.startsWith('deleteUser')))
  }
  // A login with no akun row (an earlier cleanup failed, or a save mid-creation): reported, never silent.
  {
    const { admin } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), /sudah ada tanpa data akun/)
  }
  // ...and a failed owner lookup is an error, not "exists".
  {
    const { admin } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } }, pemilik: { error: { message: 'down' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'))
  }
  // An old sidang (tanggal + 1 already past): no account, nothing touched.
  {
    const { admin, log } = fakeAdmin({})
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-01', '2026-11-14'), { created: false })
    assert.deepEqual(log, [])
    // The day after the sidang still gets one.
    assert.ok((await ensureAkunEksternal(fakeAdmin({}).admin, 'EXT-01', '2026-11-13', '2026-11-14')).created)
  }
  // ...unless that username belongs to another dosen (kodes that normalize alike).
  {
    const { admin } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } }, pemilik: { data: { kode_dosen: 'EXT01' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20', '2026-11-14'), /dosen lain/)
  }
  console.log('nilai-sidang akun eksternal: all checks passed')
}
cekEnsure().catch((e) => { console.error(e); process.exit(1) })

// ---- formulir penguji: revisi, Penilaian Saya status, old sidang
import { cekRevisi } from '../src/lib/penilaian/nilai'
import { bolehInputLamaSidang, STATUS_SIDANG } from '../src/lib/penilaian/akses'
{
  // No revisi: client rows are dropped, never stored.
  assert.deepEqual(cekRevisi(false, [{ halaman: '1', catatan: 'x' }]), { adaRevisi: false, revisi: [] })
  assert.deepEqual(cekRevisi(false, undefined), { adaRevisi: false, revisi: [] })
  // Rows are trimmed; halaman is optional.
  assert.deepEqual(cekRevisi(true, [{ halaman: ' 12 ', catatan: ' Perbaiki tabel ' }, { halaman: '', catatan: 'Tambah saran' }]), {
    adaRevisi: true, revisi: [{ halaman: '12', catatan: 'Perbaiki tabel' }, { halaman: '', catatan: 'Tambah saran' }],
  })
  // Ada revisi needs at least one row, and every row a catatan (the row is named).
  assert.ok('error' in cekRevisi(true, []))
  const kosong = cekRevisi(true, [{ halaman: '1', catatan: 'a' }, { halaman: '2', catatan: '   ' }])
  assert.ok('error' in kosong && kosong.error.includes('2'), JSON.stringify(kosong))
  // From the client: shape-checked.
  for (const bad of [null, 'x', [{ catatan: 1 }], [{ halaman: 3, catatan: 'a' }], [null], [{ catatan: 'a' }]]) {
    assert.ok('error' in cekRevisi(true, bad), JSON.stringify(bad))
  }
  assert.ok('error' in cekRevisi('ya', []))
  // Bounded: a runaway list or note is refused.
  assert.ok('error' in cekRevisi(true, Array.from({ length: 101 }, () => ({ halaman: '', catatan: 'a' }))))
  assert.ok('error' in cekRevisi(true, [{ halaman: '', catatan: 'a'.repeat(2001) }]))
  assert.ok(!('error' in cekRevisi(true, [{ halaman: '', catatan: 'a'.repeat(2000) }])))

  // Penilaian Saya: one label per access state.
  assert.equal(STATUS_SIDANG['belum-dibuka'], 'Belum dibuka')
  assert.equal(STATUS_SIDANG.isi, 'Belum dinilai')
  assert.equal(STATUS_SIDANG.kunci, 'Belum dinilai')
  assert.equal(STATUS_SIDANG['menunggu-anggota'], 'Menunggu anggota')
  assert.equal(STATUS_SIDANG.terkirim, 'Terkirim')
  assert.equal(STATUS_SIDANG.terkunci, 'Terkunci')

  const sd: SidangRef = { id: 's', prodi: 's1', jenis: 'sidang', tanggal: '2026-11-09', pembimbing_kode: 'PB', penguji_kode: 'KT', penguji_eksternal_kode: 'EX' }
  assert.equal(bolehInputLamaSidang(sd, '2026-11-10'), true)
  assert.equal(bolehInputLamaSidang(sd, '2026-11-09'), false)
  assert.equal(bolehInputLamaSidang({ ...sd, jenis: 'prasidang' }, '2026-11-10'), false)
  console.log('nilai-sidang formulir: all checks passed')
}

// ---- email revisi
import { tanggalPanjang } from '../src/lib/hari'
import { renderRevisi } from '../src/lib/penilaian/email-revisi'
import { kirimRevisi, smtpTransport, type Transport, type MailData } from '../src/lib/mailer'
async function cekEmail() {
  const input = {
    nama: 'Budi 87,50 A', npm: '2021110099', judul: 'Judul <b>tebal</b> 88', tanggal: '2026-11-09', yudisium: 'Lulus Dengan Revisi',
    revisi: [
      { peranLabel: 'Ketua Sidang', nama: 'Dr. Ani', rows: [{ halaman: '12', catatan: 'Perbaiki tabel <script>alert(x)</script>' }] },
      { peranLabel: 'Anggota Penguji II', nama: 'Dr. Cici', rows: [{ halaman: '', catatan: 'Tambah saran' }] },
    ],
  }
  const m = renderRevisi(input)
  assert.equal(m.subject, 'Revisi Sidang Skripsi — Budi 87,50 A (2021110099)')
  for (const s of [m.text, m.html]) {
    assert.ok(s.includes('Tambah saran') && s.includes('Anggota Penguji II') && s.includes('Dr. Cici') && s.includes('Lulus Dengan Revisi'))
  }
  assert.ok(!m.html.includes('<script>') && m.html.includes('&lt;script&gt;'))
  assert.ok(!m.html.includes('<b>tebal') && m.html.includes('&lt;b&gt;tebal'))
  // Only examiners with revisi are listed; the body has no grade field (digits come only from the fields passed in).
  const satu = renderRevisi({ ...input, nama: 'Budi', judul: 'Judul', revisi: [input.revisi[0]] })
  assert.ok(!satu.text.includes('Penguji II') && !satu.html.includes('Cici'))
  const digit = (s: string) => s.replace(/<[^>]*>/g, '').replace('2021110099', '').replace(tanggalPanjang('2026-11-09', false), '').replace('12', '').match(/\d/g)
  assert.equal(digit(satu.text), null, satu.text)
  assert.equal(digit(satu.html), null)

  // smtpTransport: null until all three env vars are set; never throws.
  const env = { u: process.env.SMTP_USER, p: process.env.SMTP_PASS, f: process.env.SMTP_FROM }
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.SMTP_FROM
  assert.equal(smtpTransport(), null)
  process.env.SMTP_USER = 'u@x.id'; process.env.SMTP_PASS = 'p'
  assert.equal(smtpTransport(), null)
  process.env.SMTP_FROM = 'A <u@x.id>'
  assert.equal(typeof smtpTransport(), 'function')
  for (const [k, v] of [['SMTP_USER', env.u], ['SMTP_PASS', env.p], ['SMTP_FROM', env.f]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v
  }

  const data = (over: Partial<MailData> = {}): MailData => ({
    status: 'menunggu', nama: 'Budi', npm: '2021110099', judul: 'J', tanggal: '2026-11-09', yudisium: 'Lulus Dengan Revisi',
    mahasiswaEmail: 'budi@mhs.id',
    penguji: [
      { peranLabel: 'Ketua Sidang', nama: 'Dr. Ani', email: 'ani@up.id', revisi: [{ halaman: '1', catatan: 'x' }] },
      { peranLabel: 'Anggota Penguji I', nama: 'Dr. Eko', email: '', revisi: [] },
      { peranLabel: 'Anggota Penguji II', nama: 'Dr. Cici', email: 'bukan-email', revisi: [] },
    ],
    ...over,
  })
  const jalankan = async (t: Transport | null, d = data(), timeoutMs = 50) => {
    const tulis: { status: string; detail: unknown }[] = []
    const status = await kirimRevisi('id', t, { muat: async () => d, simpan: async (_i, status, detail) => { tulis.push({ status, detail }) } }, timeoutMs)
    return { status, tulis }
  }
  const baik: Transport = async ({ to }) => ({ accepted: to, rejected: [] })

  // Blank and invalid addresses are skipped and listed; the sent ones make it 'sebagian'.
  const a = await jalankan(baik)
  assert.equal(a.status, 'sebagian')
  assert.equal(a.tulis.length, 1)
  assert.equal(a.tulis[0].status, 'sebagian')
  const detail = a.tulis[0].detail as { alamat: string; status: string; alasan?: string }[]
  assert.deepEqual(detail.map((x) => [x.alamat, x.status]), [['budi@mhs.id', 'terkirim'], ['ani@up.id', 'terkirim'], ['', 'dilewati'], ['bukan-email', 'dilewati']])
  assert.ok(detail[2].alasan?.includes('Anggota Penguji I') && detail[3].alasan?.includes('Anggota Penguji II'))
  // All valid -> terkirim; one message to everyone.
  const kirim: { to: string[]; subject: string }[] = []
  const lengkap = data({ penguji: [{ peranLabel: 'Ketua Sidang', nama: 'A', email: 'ani@up.id', revisi: [{ halaman: '', catatan: 'x' }] }] })
  const b = await jalankan(async (msg) => { kirim.push(msg); return { accepted: msg.to, rejected: [] } }, lengkap)
  assert.equal(b.status, 'terkirim')
  assert.deepEqual(kirim.map((k) => k.to), [['budi@mhs.id', 'ani@up.id']])
  assert.equal(kirim[0].subject, 'Revisi Sidang Skripsi — Budi (2021110099)')
  // Same address twice goes once.
  const dobel = data({ mahasiswaEmail: 'ANI@up.id', penguji: lengkap.penguji })
  const d2 = await jalankan(async (msg) => { assert.equal(msg.to.length, 1); return { accepted: msg.to, rejected: [] } }, dobel)
  assert.equal(d2.status, 'terkirim')
  // One rejected -> sebagian; all rejected, throw, or timeout -> gagal.
  const c = await jalankan(async ({ to }) => ({ accepted: [to[0]], rejected: [to[1]] }), lengkap)
  assert.equal(c.status, 'sebagian')
  assert.deepEqual((c.tulis[0].detail as { status: string }[]).map((x) => x.status), ['terkirim', 'gagal'])
  const d = await jalankan(async ({ to }) => ({ accepted: [], rejected: to }), lengkap)
  assert.equal(d.status, 'gagal')
  const e = await jalankan(async () => { throw new Error('535 login salah') }, lengkap)
  assert.equal(e.status, 'gagal')
  assert.ok((e.tulis[0].detail as { alasan: string }[]).every((x) => x.alasan.includes('535 login salah')))
  const t0 = Date.now()
  const f = await jalankan(() => new Promise((r) => setTimeout(() => r({ accepted: ['x'], rejected: [] }), 11_000).unref()).then((x) => x as never), lengkap)
  assert.equal(f.status, 'gagal')
  assert.ok(Date.now() - t0 < 1000)
  assert.ok((f.tulis[0].detail as { alasan: string }[])[0].alasan.includes('waktu'))
  // No transport -> gagal with the reason; no valid address -> gagal without calling it.
  const g = await jalankan(null, lengkap)
  assert.equal(g.status, 'gagal')
  assert.ok((g.tulis[0].detail as { alasan: string }[]).every((x) => x.alasan === 'SMTP belum dikonfigurasi'))
  let dipanggil = false
  const h = await jalankan(async (m) => { dipanggil = true; return { accepted: m.to, rejected: [] } }, data({ mahasiswaEmail: '', penguji: lengkap.penguji.map((p) => ({ ...p, email: null })) }))
  assert.equal(h.status, 'gagal')
  assert.equal(dipanggil, false)
  // No examiner revisi -> tidak_perlu, nothing sent or written. A finished status is never re-sent.
  const i = await jalankan(baik, data({ penguji: [] }))
  assert.deepEqual([i.status, i.tulis.length], ['tidak_perlu', 0])
  for (const s of ['terkirim', 'tidak_perlu'] as const) {
    const j = await jalankan(async () => { throw new Error('tidak boleh') }, data({ status: s }))
    assert.deepEqual([j.status, j.tulis.length], [s, 0])
  }
  // A missing sidang is left alone.
  assert.equal(await kirimRevisi('x', baik, { muat: async () => null, simpan: async () => { throw new Error('x') } }), 'tidak_perlu')
  // Retry from gagal / sebagian goes through.
  for (const s of ['gagal', 'sebagian'] as const) assert.equal((await jalankan(baik, data({ ...lengkap, status: s }))).status, 'terkirim')
  console.log('nilai-sidang email: all checks passed')
}
cekEmail().catch((e) => { console.error(e); process.exit(1) })

// ---- humanDbError: sidang lock and grade errors
{
  for (const m of ['Penguji/tanggal tidak dapat diubah: sidang ini sudah dinilai.', 'Mahasiswa tidak dapat diubah: sidang ini sudah dinilai.']) {
    assert.equal(humanDbError({ code: 'P0001', message: m }), m)
  }
  const fkSidang = (c: string, t: string) => ({ code: '23503', message: `update or delete on table "defenses" violates foreign key constraint "${c}" on table "${t}"`, details: `Key (id)=(x) is still referenced from table "${t}".` })
  assert.equal(humanDbError(fkSidang('nilai_sidang_defense_id_fkey', 'nilai_sidang')), 'Sidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  assert.equal(humanDbError(fkSidang('hasil_sidang_defense_id_fkey', 'hasil_sidang')), 'Sidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  // by constraint name only: the lecturer FK on nilai_sidang is a different problem, and bimbingan keeps its own wording
  assert.match(humanDbError(fkSidang('nilai_sidang_kode_dosen_fkey', 'nilai_sidang')), /masih dipakai/)
  assert.doesNotMatch(humanDbError(fkSidang('nilai_sidang_kode_dosen_fkey', 'nilai_sidang')), /Sidang ini/)
  assert.equal(humanDbError(fkSidang('nilai_bimbingan_defense_id_fkey', 'nilai_bimbingan')), 'Prasidang ini sudah dinilai, sehingga tidak bisa dihapus.')
  // RPC race: already locked
  assert.equal(humanDbError({ code: '42501', message: 'Nilai sidang sudah dikunci.' }), 'Nilai sidang ini sudah dikunci. Muat ulang halaman.')
  assert.match(humanDbError({ code: '42501', message: 'permission denied for table x' }), /izin/) // other 42501 unchanged
  // yudisium not in the pair list
  assert.equal(humanDbError({ code: '23514', message: 'Yudisium tidak ada dalam pilihan yudisium.' }), 'Pilihan yudisium tidak valid. Muat ulang halaman.')
  // other check_violations are not hijacked
  assert.match(humanDbError({ code: '23514', message: 'new row violates check constraint "x"' }), /tidak sesuai aturan/)
  assert.match(humanDbError({ code: '23514', message: 'Revisi tidak valid.' }), /tidak sesuai aturan/)
  console.log('nilai-sidang db-error: all checks passed')
}

// ---- rekap Nilai Akhir
import { ANGGOTA_I_LEGACY } from '../src/lib/penilaian/akses'
import { bimbinganTerbaru, bolehKirimUlang, buildRekapAkhir, EMAIL_LABEL } from '../src/lib/penilaian/rekap'
import { smtpOpsi } from '../src/lib/mailer'
{
  const sd = (id: string, npm: string, nama: string, over: Record<string, unknown> = {}) => ({
    id, tanggal: '2026-11-10', npm, nama_mahasiswa: nama, judul_skripsi: `Judul ${nama}`,
    penguji_kode: 'K', penguji_eksternal_kode: 'E', pembimbing_kode: 'P', ...over,
  })
  const sidang = [
    sd('d-ok', '2021110001', 'ABDURRAHMAN'),
    sd('d-bim', '2021110002', 'BUDI'),
    sd('d-gagal', '2021110003', 'CICI'),
    sd('d-legacy', '2021110004', 'DANI', { penguji_eksternal_kode: null, tanggal: '2026-11-09' }),
    sd('d-rusak', '2021110005', 'EKA'),
  ]
  const mhs = (npm: string, over: Record<string, unknown> = {}) => ({ npm, sks_sebelum: 139, bobot_sebelum: 404.57, tepat_waktu: true, ...over })
  const students = [mhs('2021110001'), mhs('2021110002'), mhs('2021110003'), mhs('2021110004'), mhs('2021110005')]
  const tiga = (id: string, n: number) => (['ketua', 'anggota_1', 'anggota_2'] as const).map((peran) => ({ defense_id: id, peran, nilai: n }))
  const nilai = [...tiga('d-ok', 76.5), ...tiga('d-bim', 76.5), ...tiga('d-gagal', 40), ...tiga('d-rusak', 80)]
  const hasil = (id: string, label: string, lulus: boolean, email: string | null, aturan: unknown = beku) =>
    ({ defense_id: id, yudisium_label: label, yudisium_lulus: lulus, aturan, locked_at: '2026-11-10T03:00:00Z', email_status: email })
  const hs = [
    hasil('d-ok', 'Lulus Tanpa Revisi', true, 'terkirim'),
    hasil('d-bim', 'Lulus Dengan Revisi', true, 'sebagian'),
    hasil('d-gagal', 'Tidak Lulus', false, 'tidak_perlu'),
    hasil('d-rusak', 'Lulus Tanpa Revisi', true, 'gagal', { tabelNilai: 'rusak' }),
  ]
  const namaDosen = (k: string) => `Dosen ${k}`

  // Bimbingan: the LATEST prasidang of the NPM decides, even when an older one is complete or the newest is still open.
  const pra = [
    { id: 'p-lama', tanggal: '2025-05-01', npm: '2021110001' },
    { id: 'p-baru', tanggal: '2026-05-01', npm: '2021110001' },
    { id: 'p-sebagian', tanggal: '2026-05-02', npm: '2021110002' },
    { id: 'p-tua', tanggal: '2025-01-01', npm: '2021110003' },
    { id: 'p-kosong', tanggal: '2026-01-01', npm: '2021110003' },
  ]
  const nb = [
    { defense_id: 'p-lama', peran: 'pembimbing_1' as const, nilai: 60 }, { defense_id: 'p-lama', peran: 'pembimbing_2' as const, nilai: 60 },
    { defense_id: 'p-baru', peran: 'pembimbing_1' as const, nilai: 78 }, { defense_id: 'p-baru', peran: 'pembimbing_2' as const, nilai: 79 },
    { defense_id: 'p-sebagian', peran: 'pembimbing_1' as const, nilai: 80 },
    { defense_id: 'p-tua', peran: 'pembimbing_1' as const, nilai: 70 }, { defense_id: 'p-tua', peran: 'pembimbing_2' as const, nilai: 70 },
  ]
  const bim = bimbinganTerbaru(pra, nb)
  assert.equal(bim.get('2021110001'), 78.5) // latest of two, not 60
  assert.equal(bim.get('2021110002'), null) // one dosen only
  assert.equal(bim.get('2021110003'), null) // latest has no grades; the older complete one is not used
  assert.equal(bim.has('2021110004'), false)
  assert.deepEqual(Object.fromEntries(bimbinganTerbaru([...pra].reverse(), [...nb].reverse())), Object.fromEntries(bim)) // input order does not matter

  const rows = buildRekapAkhir(sidang, students, nilai, hs, bim, namaDosen)
  assert.deepEqual(rows.map((r) => r.defenseId), ['d-legacy', 'd-ok', 'd-bim', 'd-gagal', 'd-rusak']) // tanggal, then nama
  const by = (id: string) => rows.find((r) => r.defenseId === id)!

  // complete: ABDURRAHMAN
  const ok = by('d-ok')
  assert.deepEqual([ok.npm, ok.nama, ok.judul, ok.tanggal], ['2021110001', 'ABDURRAHMAN', 'Judul ABDURRAHMAN', '2026-11-10'])
  assert.equal(ok.bimbingan, 78.5)
  assert.deepEqual(ok.penguji, {
    ketua: { nama: 'Dosen K', nilai: 76.5 }, anggota_1: { nama: 'Dosen E', nilai: 76.5 }, anggota_2: { nama: 'Dosen P', nilai: 76.5 },
  })
  assert.deepEqual(ok.hasil, {
    status: 'lengkap', nilaiSidang: 76.5, nilaiAkhir: 77.5, huruf: 'A-', mutu: 3.67, ipkSebelum: 2.91, ipkSetelah: 2.94, predikat: 'Sangat Memuaskan',
  })
  assert.equal(ok.yudisium, 'Lulus Tanpa Revisi')
  assert.equal(ok.emailStatus, 'terkirim')
  assert.equal(ok.hurufSidang, 'A-')
  assert.equal(ok.ipkSebelum, 2.91)

  // menunggu-bimbingan: nilai sidang shown, reason in place of the rest
  const bm = by('d-bim')
  assert.equal(bm.bimbingan, null)
  assert.equal(bm.hasil.status, 'menunggu-bimbingan')
  assert.equal(bm.hasil.nilaiSidang, 76.5)
  assert.ok('alasan' in bm.hasil && bm.hasil.alasan === 'Menunggu Nilai Bimbingan lengkap')
  assert.equal(bm.emailStatus, 'sebagian')

  // tidak-lulus (and no prasidang at all for this NPM)
  const gl = by('d-gagal')
  assert.equal(gl.bimbingan, null)
  assert.equal(gl.hasil.status, 'tidak-lulus')
  assert.equal(gl.hasil.nilaiSidang, 40)
  assert.equal(gl.yudisium, 'Tidak Lulus')
  assert.equal(gl.emailStatus, 'tidak_perlu')
  assert.equal(gl.hurufSidang, baris(40, beku.tabelNilai).huruf)

  // not locked, legacy free-text Anggota I (no kode, no grade)
  const lg = by('d-legacy')
  assert.equal(lg.hasil.status, 'menunggu-ketua')
  assert.equal(lg.hasil.nilaiSidang, null)
  assert.equal(lg.penguji.anggota_1.nama, ANGGOTA_I_LEGACY)
  assert.equal(lg.penguji.anggota_1.nilai, null)
  assert.equal(lg.penguji.ketua.nilai, null)
  assert.deepEqual([lg.yudisium, lg.emailStatus, lg.hurufSidang], [null, null, null])

  // frozen rules unreadable: a pending reason, never NaN or a throw
  const rs = by('d-rusak')
  assert.equal(rs.hasil.status, 'data-kurang')
  assert.ok('alasan' in rs.hasil && rs.hasil.alasan.length > 0)
  assert.equal(rs.hasil.nilaiSidang, 80)
  assert.equal(rs.hurufSidang, null)

  // students missing -> SKS/Bobot reason, IPK sebelum blank
  const tanpa = buildRekapAkhir([sidang[0]], [], nilai, hs, bim, namaDosen)[0]
  assert.ok('alasan' in tanpa.hasil && tanpa.hasil.alasan === 'SKS/Bobot belum diisi')
  assert.equal(tanpa.ipkSebelum, null)

  // kirim ulang: gagal/sebagian always; menunggu only once the first send is clearly stuck (2 min)
  const kunci = '2026-11-10T03:00:00Z'
  const jam = (s: number) => new Date(Date.parse(kunci) + s * 1000)
  assert.equal(bolehKirimUlang('gagal', kunci, jam(0)), true)
  assert.equal(bolehKirimUlang('sebagian', kunci, jam(0)), true)
  assert.equal(bolehKirimUlang('menunggu', kunci, jam(119)), false)
  assert.equal(bolehKirimUlang('menunggu', kunci, jam(121)), true)
  assert.equal(bolehKirimUlang('menunggu', 'bukan tanggal', jam(999)), false)
  for (const s of ['terkirim', 'tidak_perlu', null]) assert.equal(bolehKirimUlang(s, kunci, jam(9999)), false)
  assert.equal(EMAIL_LABEL.gagal, 'Gagal')

  // SMTP: every phase times out, so a send the 10 s race gave up on cannot deliver later
  const opsi = smtpOpsi('u@x.id', 'p')
  assert.deepEqual([opsi.connectionTimeout, opsi.greetingTimeout, opsi.socketTimeout], [10_000, 10_000, 10_000])
  assert.deepEqual([opsi.host, opsi.port, opsi.secure], ['smtp.gmail.com', 465, true])
  console.log('nilai-sidang rekap akhir: all checks passed')
}

// ---- rekap Nilai Akhir: the xlsx
import ExcelJS from 'exceljs'
import { buildRekapAkhirXlsx } from '../src/lib/penilaian/rekap-xlsx'
void (async () => {
  const tiga = { ketua: { nama: 'Dosen K', nilai: 76.5 }, anggota_1: { nama: 'Dosen E', nilai: 76.5 }, anggota_2: { nama: 'Dosen P', nilai: null } }
  const dasar = { tanggal: '2026-11-10', judul: 'J', penguji: tiga, ipkSebelum: 2.91, hurufSidang: null, lockedAt: null, yudisium: null, emailStatus: null }
  const buf = await buildRekapAkhirXlsx([
    {
      ...dasar, defenseId: 'a', npm: '1', nama: 'A', bimbingan: 78.5, yudisium: 'Lulus Tanpa Revisi', emailStatus: 'gagal', hurufSidang: 'A-',
      hasil: { status: 'lengkap', nilaiSidang: 76.5, nilaiAkhir: 77.5, huruf: 'A-', mutu: 3.67, ipkSebelum: 2.91, ipkSetelah: 2.94, predikat: 'Sangat Memuaskan' },
    },
    { ...dasar, defenseId: 'b', npm: '2', nama: 'B', bimbingan: null, hasil: { status: 'menunggu-ketua', nilaiSidang: null, alasan: 'Menunggu Ketua Penguji mengunci hasil sidang' } },
  ])
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  assert.deepEqual((ws.getRow(1).values as unknown[]).slice(1), [
    'NPM', 'Nama', 'Judul', 'Nilai Bimbingan', 'Ketua', 'Nilai Ketua', 'Anggota I', 'Nilai I', 'Anggota II', 'Nilai II', 'Nilai Sidang', 'Huruf Sidang',
    'Yudisium', 'Nilai Akhir', 'Huruf', 'Bobot Mutu', 'IPK Sebelum', 'IPK Setelah', 'Predikat', 'Status Email',
  ])
  const a = ws.getRow(2)
  for (const c of [4, 6, 8, 11, 14, 16, 17, 18]) {
    assert.equal(typeof a.getCell(c).value, 'number', `col ${c}`)
    assert.equal(a.getCell(c).numFmt, '0.00')
  }
  assert.equal(a.getCell(14).value, 77.5)
  assert.equal(a.getCell(20).value, 'Gagal')
  // pending: reason in Nilai Akhir, the numeric result cells blank
  const b = ws.getRow(3)
  assert.equal(b.getCell(14).value, 'Menunggu Ketua Penguji mengunci hasil sidang')
  for (const c of [4, 10, 11, 15, 16, 18, 19, 20]) assert.equal(b.getCell(c).value, null, `col ${c}`)
  console.log('nilai-sidang rekap akhir xlsx: all checks passed')
})().catch((e) => { console.error(e); process.exit(1) })
