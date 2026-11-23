import { aksiKanal, topikKanal } from '../src/lib/penilaian/live'
import { buildBeritaAcaraXlsx } from '../src/lib/penilaian/berita-acara-xlsx'
import { barAspek, barPenguji, rataRata } from '../src/lib/penilaian/grafik'
import { hasilBeritaAcara } from '../src/lib/penilaian/berita-acara-sidang'
import { validateKetentuan } from '../src/lib/penilaian/aturan'
import { statusNilaiSidang } from '../src/lib/penilaian/rekap'
import { sectionOf } from '../src/components/nav-sections'
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
  // The Ketua grades like an anggota, in any order; once sent it waits for both anggota, then locks.
  assert.deepEqual(aksesSidang(sd, 'KT', o()), { kind: 'isi', peran: 'ketua' })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['anggota_1', 'anggota_2']) })), { kind: 'isi', peran: 'ketua' })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['ketua']) })), { kind: 'menunggu-anggota', kurang: ['anggota_1', 'anggota_2'] })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['ketua', 'anggota_2']) })), { kind: 'menunggu-anggota', kurang: ['anggota_1'] })
  assert.deepEqual(aksesSidang(sd, 'KT', o({ submitted: new Set(['ketua', 'anggota_1', 'anggota_2']) })), { kind: 'kunci', peran: 'ketua' })
  assert.deepEqual(aksesSidang(sd, 'EX', o({ submitted: new Set(['ketua', 'anggota_1']) })), { kind: 'terkirim', peran: 'anggota_1' })
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
import { adminSidang, STATUS_SIDANG } from '../src/lib/penilaian/akses'
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
  assert.equal(STATUS_SIDANG.kunci, 'Siap dikunci')
  assert.equal(STATUS_SIDANG['menunggu-anggota'], 'Menunggu anggota')
  assert.equal(STATUS_SIDANG.terkirim, 'Terkirim')
  assert.equal(STATUS_SIDANG.terkunci, 'Terkunci')

  // Super Admin, any date: enters a missing anggota grade; locks for the Ketua once both anggota are in.
  const ref = { penguji_kode: 'KT', penguji_eksternal_kode: 'EX', pembimbing_kode: 'PB' }
  const ada = (...p: PeranSidang[]) => new Set<PeranSidang>(p)
  assert.deepEqual(adminSidang(ref, ada(), false), { isi: ['ketua', 'anggota_1', 'anggota_2'], kunci: false })
  assert.deepEqual(adminSidang(ref, ada('anggota_1', 'anggota_2'), false), { isi: ['ketua'], kunci: false })
  assert.deepEqual(adminSidang(ref, ada('ketua', 'anggota_1', 'anggota_2'), false), { isi: [], kunci: true })
  assert.deepEqual(adminSidang(ref, ada(), true), { isi: [], kunci: false }) // locked: edit only
  assert.deepEqual(adminSidang({ ...ref, penguji_eksternal_kode: null }, ada(), false), { isi: ['ketua', 'anggota_2'], kunci: false }) // legacy Anggota I
  assert.deepEqual(adminSidang({ ...ref, penguji_kode: null }, ada('anggota_1', 'anggota_2'), false), { isi: [], kunci: false }) // no Ketua chosen

  console.log('nilai-sidang formulir: all checks passed')
}

// ---- email revisi
import { tanggalPanjang } from '../src/lib/hari'
import { ISI_PRASIDANG, renderRevisi, semesterTA, SUBJEK_PRASIDANG } from '../src/lib/penilaian/email-revisi'
import { kirimRevisi, smtpTransport, type Transport, type MailData, type MailDeps } from '../src/lib/mailer'
import type { FormRevisi } from '../src/lib/penilaian/form-revisi-xlsx'
async function cekEmail() {
  const input = {
    nama: 'Budi 87,50 A', npm: '2021110099', judul: 'Judul <b>tebal</b> 88', tanggal: '2026-11-09', yudisium: 'Lulus Dengan Revisi', academicYearId: '20252',
    revisi: [
      { peranLabel: 'Ketua Sidang', nama: 'Dr. Ani', rows: [{ halaman: '12', catatan: 'Perbaiki tabel <script>alert(x)</script>' }] },
      { peranLabel: 'Anggota Penguji II', nama: 'Dr. Cici', rows: [{ halaman: '', catatan: 'Tambah saran' }] },
    ],
  }
  const m = renderRevisi(input)
  assert.equal(m.subject, 'Revisi Sidang Skripsi — Budi 87,50 A (2021110099)')
  for (const s of [m.text, m.html]) {
    assert.ok(s.includes('Tambah saran') && s.includes('Anggota Penguji II') && s.includes('Dr. Cici'))
    assert.ok(s.includes('Kepada Yth,') && s.includes('Semester Genap TA. 2025/2026.') && s.includes('Akademik F.Psi UP'))
  }
  assert.ok(m.text.startsWith('Kepada Yth,\nBudi 87,50 A\n\n\nBerikut dikirimkan Form Revisi Sidang Skripsi\n'), m.text)
  assert.equal(semesterTA('20251'), 'Gasal TA. 2025/2026')
  assert.equal(semesterTA('x'), 'x')
  // PDF attached: no tables appended to a body without {revisi}; with {revisi}, they stay where it says.
  const pdf = renderRevisi({ ...input, lampiran: true })
  assert.ok(pdf.text.endsWith('Salam,\nAkademik F.Psi UP') && !pdf.html.includes('Tambah saran'), pdf.text)
  assert.ok(renderRevisi({ ...input, lampiran: true, template: { subjek: '', isi: '{revisi}' } }).text.includes('Tambah saran'))
  assert.ok(!m.html.includes('<script>') && m.html.includes('&lt;script&gt;'))
  const j = renderRevisi({ ...input, template: { subjek: '', isi: 'Judul: {judul}' } }).html
  assert.ok(!j.includes('<b>tebal') && j.includes('&lt;b&gt;tebal'))
  // Only examiners with revisi are listed; the body has no grade field (digits come only from the fields passed in).
  const satu = renderRevisi({ ...input, nama: 'Budi', judul: 'Judul', revisi: [input.revisi[0]] })
  assert.ok(!satu.text.includes('Penguji II') && !satu.html.includes('Cici'))
  const digit = (s: string) => s.replace(/<[^>]*>/g, '').replace('2021110099', '').replace(tanggalPanjang('2026-11-09', false), '').replace('12', '').replace('2025/2026', '').match(/\d/g)
  assert.equal(digit(satu.text), null, satu.text)
  assert.equal(digit(satu.html), null)

  // The admin's template (Pengaturan): placeholders filled, its own text escaped in HTML, {revisi} where it says.
  const t = renderRevisi({ ...input, template: { subjek: 'Revisi {npm}\nbaru', isi: 'Halo {nama} <i>x</i>\n{revisi}\nSalam' } })
  assert.equal(t.subject, 'Revisi 2021110099 baru')
  assert.ok(t.text.startsWith('Halo Budi 87,50 A <i>x</i>\nKetua Sidang: Dr. Ani') && t.text.endsWith('Salam'), t.text)
  assert.ok(t.html.includes('Halo Budi 87,50 A &lt;i&gt;x&lt;/i&gt;') && t.html.indexOf('Dr. Cici') < t.html.indexOf('Salam'), t.html)
  // A body without {revisi} still carries the tables; a blank template falls back to the default.
  assert.ok(renderRevisi({ ...input, template: { subjek: '', isi: 'Halo {nama}' } }).text.includes('Tambah saran'))
  assert.equal(renderRevisi({ ...input, template: { subjek: ' ', isi: ' ' } }).text, m.text)

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
    status: 'menunggu', nama: 'Budi', npm: '2021110099', judul: 'J', tanggal: '2026-11-09', yudisium: 'Lulus Dengan Revisi', academicYearId: '20252',
    mahasiswaEmail: 'budi@mhs.id', detailLama: [], kop: ['FAKULTAS PSIKOLOGI', 'Jl. X'],
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
  // Kaprodi / Wakil Dekan I in CC, tracked like any recipient; a blank CC setting is not a skipped recipient.
  const kirimCc: { to: string[]; cc?: string[] }[] = []
  const denganCc = data({ ...lengkap, cc: [{ siapa: 'Kaprodi', email: 'kaprodi@up.id' }, { siapa: 'Wakil Dekan I', email: ' ' }] })
  const gCc = await jalankan(async (msg) => { kirimCc.push(msg); return { accepted: [...msg.to, ...(msg.cc ?? [])], rejected: [] } }, denganCc)
  assert.equal(gCc.status, 'terkirim')
  assert.deepEqual(kirimCc.map((k) => [k.to, k.cc]), [[['budi@mhs.id', 'ani@up.id'], ['kaprodi@up.id']]])
  const ccSalah = await jalankan(baik, data({ ...lengkap, cc: [{ siapa: 'Wakil Dekan I', email: 'salah' }] }))
  assert.equal(ccSalah.status, 'sebagian')
  assert.ok((ccSalah.tulis[0].detail as { alasan?: string }[]).some((x) => x.alasan === 'Email Wakil Dekan I tidak valid'))
  // Retry after only the CC failed: just the CC is mailed again.
  const ulangCc = await jalankan(async (msg) => { assert.deepEqual([msg.to, msg.cc], [[], ['kaprodi@up.id']]); return { accepted: msg.cc ?? [], rejected: [] } },
    data({ ...denganCc, status: 'sebagian', detailLama: [{ alamat: 'budi@mhs.id', status: 'terkirim' }, { alamat: 'ani@up.id', status: 'terkirim' }, { alamat: 'kaprodi@up.id', status: 'gagal' }] }))
  assert.equal(ulangCc.status, 'terkirim')
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
  // No examiner revisi -> tidak_perlu, nothing sent, but it IS recorded (else a retry button on gagal stays forever).
  let kirimNol = false
  const i = await jalankan(async (m) => { kirimNol = true; return { accepted: m.to, rejected: [] } }, data({ status: 'gagal', penguji: [] }))
  assert.deepEqual([i.status, kirimNol], ['tidak_perlu', false])
  assert.deepEqual(i.tulis, [{ status: 'tidak_perlu', detail: [] }])
  // A finished status is never re-sent or re-written.
  for (const s of ['terkirim', 'tidak_perlu'] as const) {
    const j = await jalankan(async () => { throw new Error('tidak boleh') }, data({ status: s }))
    assert.deepEqual([j.status, j.tulis.length], [s, 0])
  }
  // A missing sidang is left alone.
  assert.equal(await kirimRevisi('x', baik, { muat: async () => null, simpan: async () => { throw new Error('x') } }), 'tidak_perlu')
  // Retry from gagal / sebagian goes through.
  for (const s of ['gagal', 'sebagian'] as const) assert.equal((await jalankan(baik, data({ ...lengkap, status: s }))).status, 'terkirim')
  // Retry sends only to addresses not already terkirim, and merges the outcome into the stored detail.
  const tigaPenerima = data({
    status: 'sebagian', mahasiswaEmail: 'budi@mhs.id',
    penguji: [
      { peranLabel: 'Ketua Sidang', nama: 'A', email: 'ani@up.id', revisi: [{ halaman: '', catatan: 'x' }] },
      { peranLabel: 'Anggota Penguji II', nama: 'C', email: 'eko@up.id', revisi: [] },
    ],
    detailLama: [
      { alamat: 'BUDI@mhs.id', status: 'terkirim' }, { alamat: 'ani@up.id', status: 'gagal', alasan: 'x' }, { alamat: 'eko@up.id', status: 'terkirim' },
    ],
  })
  const tujuan: string[][] = []
  const ulang = await jalankan(async (msg) => { tujuan.push(msg.to); return { accepted: msg.to, rejected: [] } }, tigaPenerima)
  assert.deepEqual(tujuan, [['ani@up.id']])
  assert.equal(ulang.status, 'terkirim')
  const dUlang = ulang.tulis[0].detail as { alamat: string; status: string }[]
  assert.deepEqual(dUlang.map((x) => x.status), ['terkirim', 'terkirim', 'terkirim'])
  assert.deepEqual(dUlang.map((x) => x.alamat.toLowerCase()).sort(), ['ani@up.id', 'budi@mhs.id', 'eko@up.id'])
  // The retry fails again: the earlier successes stay in the detail, so it stays 'sebagian', not 'gagal'.
  const lagi = await jalankan(async () => { throw new Error('421 sibuk') }, tigaPenerima)
  assert.equal(lagi.status, 'sebagian')
  assert.deepEqual((lagi.tulis[0].detail as { status: string }[]).map((x) => x.status).sort(), ['gagal', 'terkirim', 'terkirim'])
  // Everyone valid already got it, one address was skipped: nothing is sent, the status reflects the skip.
  let kirimLagi = false
  const sisa = await jalankan(async (m) => { kirimLagi = true; return { accepted: m.to, rejected: [] } }, data({
    status: 'sebagian', mahasiswaEmail: '',
    penguji: [{ peranLabel: 'Ketua Sidang', nama: 'A', email: 'ani@up.id', revisi: [{ halaman: '', catatan: 'x' }] }],
    detailLama: [{ alamat: 'ani@up.id', status: 'terkirim' }, { alamat: '', status: 'dilewati', alasan: 'Email Mahasiswa kosong' }],
  }))
  assert.equal(kirimLagi, false)
  assert.equal(sisa.status, 'sebagian')
  // A 'gagal' retry with a stored detail where nothing was delivered still sends to everyone.
  const semuaGagal = await jalankan(async (msg) => { tujuan.push(msg.to); return { accepted: msg.to, rejected: [] } }, data({
    ...lengkap, status: 'gagal', detailLama: [{ alamat: 'budi@mhs.id', status: 'gagal', alasan: 'x' }],
  }))
  assert.deepEqual(tujuan[1], ['budi@mhs.id', 'ani@up.id'])
  assert.equal(semuaGagal.status, 'terkirim')

  // The form revisi PDF goes along as an attachment, built from the examiners' revisi.
  type Lampiran = NonNullable<Parameters<Transport>[0]['attachments']>
  const lampiran: Lampiran[] = []
  const bentuk: FormRevisi[] = []
  const pakaiPdf = async (pdf: MailDeps['pdf'], t: Transport, d = lengkap) => {
    const tulis: string[] = []
    const status = await kirimRevisi('id', t, { muat: async () => d, simpan: async (_i, s) => { tulis.push(s) }, pdf }, 50)
    return { status, tulis }
  }
  const catat: Transport = async (msg) => { lampiran.push(msg.attachments ?? []); return { accepted: msg.to, rejected: [] } }
  const p1 = await pakaiPdf(async (f) => { bentuk.push(f); return new Uint8Array([37, 80, 68, 70]) }, catat, data())
  assert.equal(p1.status, 'sebagian')
  assert.equal(lampiran[0].length, 1)
  assert.equal(lampiran[0][0].filename, 'Form Revisi Sidang 2021110099 Budi.pdf')
  assert.equal(lampiran[0][0].contentType, 'application/pdf')
  assert.deepEqual([...lampiran[0][0].content], [37, 80, 68, 70])
  assert.deepEqual(bentuk[0], {
    jenis: 'sidang', kolom: 'Halaman', hasil: 'Lulus Dengan Revisi', npm: '2021110099', nama: 'Budi', judul: 'J', tanggal: '2026-11-09',
    kop: ['FAKULTAS PSIKOLOGI', 'Jl. X'],
    bagian: [
      { peranLabel: 'Ketua Sidang', nama: 'Dr. Ani', rows: [{ rujukan: '1', catatan: 'x' }] },
      { peranLabel: 'Anggota Penguji I', nama: 'Dr. Eko', rows: [] },
      { peranLabel: 'Anggota Penguji II', nama: 'Dr. Cici', rows: [] },
    ],
  })
  // A PDF that fails or hangs never blocks the mail: it goes without the attachment (the body has every revisi).
  const p2 = await pakaiPdf(async () => { throw new Error('Aspose 429') }, catat)
  assert.deepEqual([p2.status, lampiran[1]], ['terkirim', []])
  const t1 = Date.now()
  const p3 = await pakaiPdf(() => new Promise<never>(() => {}), catat)
  assert.deepEqual([p3.status, lampiran[2]], ['terkirim', []])
  assert.ok(Date.now() - t1 < 1000)
  // No transport or no one to mail: no PDF is made (Aspose quota is 150 calls a month).
  let dibuat = 0
  const hitung: MailDeps['pdf'] = async () => { dibuat++; return new Uint8Array() }
  await pakaiPdf(hitung, null as unknown as Transport)
  await pakaiPdf(hitung, catat, data({ mahasiswaEmail: '', penguji: lengkap.penguji.map((p) => ({ ...p, email: null })) }))
  assert.equal(dibuat, 0)

  // Catatan prasidang: same send, to the student + Pendamping with CC; the form is jenis prasidang, column Pertanyaan.
  const pra = data({
    jenis: 'prasidang', yudisium: 'Skripsi layak untuk dilanjutkan dengan revisi',
    penguji: [{ peranLabel: 'Dosen Pembimbing Pendamping', nama: 'Dr. Ani', email: 'ani@up.id', revisi: [{ halaman: 'Substansi (isi) Proposal', catatan: 'Pertajam' }] }],
    cc: [{ siapa: 'Kaprodi', email: 'kaprodi@up.id' }, { siapa: 'Wakil Dekan I', email: 'wadek@up.id' }],
    template: { subjek: SUBJEK_PRASIDANG, isi: ISI_PRASIDANG },
  })
  const praMsg: Parameters<Transport>[0][] = []
  const praForm: FormRevisi[] = []
  const pr = await kirimRevisi('id', async (msg) => { praMsg.push(msg); return { accepted: [...msg.to, ...(msg.cc ?? [])], rejected: [] } },
    { muat: async () => pra, simpan: async () => {}, pdf: async (f) => { praForm.push(f); return new Uint8Array([1]) } }, 50)
  assert.equal(pr, 'terkirim')
  assert.deepEqual([praMsg[0].to, praMsg[0].cc], [['budi@mhs.id', 'ani@up.id'], ['kaprodi@up.id', 'wadek@up.id']])
  assert.equal(praMsg[0].subject, 'Catatan Prasidang Skripsi — Budi (2021110099)')
  assert.ok(praMsg[0].text.includes('Hasil prasidang: Skripsi layak untuk dilanjutkan dengan revisi') && !praMsg[0].text.includes('Pertajam'), praMsg[0].text)
  assert.equal(praMsg[0].attachments?.[0].filename, 'Form Revisi Prasidang 2021110099 Budi.pdf')
  assert.deepEqual([praForm[0].jenis, praForm[0].kolom, praForm[0].bagian[0].rows], ['prasidang', 'Pertanyaan', [{ rujukan: 'Substansi (isi) Proposal', catatan: 'Pertajam' }]])
  // PDF failed: the catatan go in the body, keyed by the question, not "Halaman".
  const praTanpaPdf = renderRevisi({ ...pra, kolom: 'Pertanyaan', revisi: [{ peranLabel: 'Dosen Pembimbing Pendamping', nama: 'Dr. Ani', rows: pra.penguji[0].revisi }] })
  assert.ok(praTanpaPdf.text.includes('- Substansi (isi) Proposal: Pertajam') && !praTanpaPdf.text.includes('Halaman'), praTanpaPdf.text)
  assert.ok(praTanpaPdf.html.includes('>Pertanyaan</th>'))
  // Blank Pengaturan template: the prasidang defaults, never the sidang ones.
  const praKosong = renderRevisi({ ...pra, kolom: 'Pertanyaan', lampiran: true, revisi: [], template: { subjek: ' ', isi: '' } })
  assert.equal(praKosong.subject, 'Catatan Prasidang Skripsi — Budi (2021110099)')
  assert.ok(praKosong.text.includes('Prasidang Skripsi') && praKosong.text.includes('Hasil prasidang: Skripsi layak'), praKosong.text)
  // Form revisi with kop: logo + kop lines on top (column C), the form title under the rule; no kop = title first.
  {
    const ExcelJS = (await import('exceljs')).default
    const { buildFormRevisiXlsx } = await import('../src/lib/penilaian/form-revisi-xlsx')
    const form: FormRevisi = { ...bentuk[0], kop: ['FAKULTAS PSIKOLOGI', 'Gedung F', 'Telp. 021'] }
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildFormRevisiXlsx(form)).buffer as ArrayBuffer)
    const ws = wb.worksheets[0]
    assert.deepEqual([ws.getCell('C1').value, ws.getCell('C2').value, ws.getCell('C3').value], ['FAKULTAS PSIKOLOGI', 'Gedung F', 'Telp. 021'])
    assert.equal(ws.getImages().length, 1, 'the UP logo')
    const judulRow = ws.getColumn(1).values.findIndex((v) => typeof v === 'string' && v.startsWith('FORM REVISI SIDANG'))
    assert.ok(judulRow > 4, String(judulRow))
    const tanpa = new ExcelJS.Workbook()
    await tanpa.xlsx.load((await buildFormRevisiXlsx({ ...form, kop: [] })).buffer as ArrayBuffer)
    assert.match(String(tanpa.worksheets[0].getCell('A1').value), /^FORM REVISI SIDANG/)
    assert.equal(tanpa.worksheets[0].getImages().length, 0)
  }
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
  // by constraint name only: the lecturer FK on nilai_sidang is a different problem; bimbingan is graded on the sidang too
  assert.match(humanDbError(fkSidang('nilai_sidang_kode_dosen_fkey', 'nilai_sidang')), /masih dipakai/)
  assert.doesNotMatch(humanDbError(fkSidang('nilai_sidang_kode_dosen_fkey', 'nilai_sidang')), /Sidang ini/)
  assert.equal(humanDbError(fkSidang('nilai_bimbingan_defense_id_fkey', 'nilai_bimbingan')), 'Sidang ini sudah dinilai, sehingga tidak bisa dihapus.')
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
import { ALASAN_ATURAN_RUSAK, bimbinganPerSidang, bolehKirimUlang, buildRekapAkhir, EMAIL_LABEL, parseDetailEmail } from '../src/lib/penilaian/rekap'
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
  const gagalDetail = [{ alamat: 'budi@mhs.id', status: 'terkirim' }, { alamat: 'ani@up.id', status: 'gagal', alasan: 'Ditolak server email' }, { alamat: '', status: 'dilewati', alasan: 'Email Anggota Penguji I kosong' }]
  const hasil = (id: string, label: string, lulus: boolean, email: string | null, aturan: unknown = beku, detail: unknown = null) =>
    ({ defense_id: id, yudisium_label: label, yudisium_lulus: lulus, aturan, locked_at: '2026-11-10T03:00:00Z', email_status: email, email_detail: detail })
  const hs = [
    hasil('d-ok', 'Lulus Tanpa Revisi', true, 'terkirim'),
    hasil('d-bim', 'Lulus Dengan Revisi', true, 'sebagian', beku, gagalDetail),
    hasil('d-gagal', 'Tidak Lulus', false, 'tidak_perlu'),
    hasil('d-rusak', 'Lulus Tanpa Revisi', true, 'gagal', { tabelNilai: 'rusak' }),
  ]
  const namaDosen = (k: string) => `Dosen ${k}`

  // Bimbingan: graded on the sidang itself, so each sidang has its own (a retake gets a fresh one).
  const nb = [
    { defense_id: 'd-ok', peran: 'pembimbing_1' as const, nilai: 78 }, { defense_id: 'd-ok', peran: 'pembimbing_2' as const, nilai: 79 },
    { defense_id: 'd-bim', peran: 'pembimbing_1' as const, nilai: 80 },
    { defense_id: 'd-rusak', peran: 'pembimbing_1' as const, nilai: 90 }, { defense_id: 'd-rusak', peran: 'pembimbing_2' as const, nilai: 90 },
    { defense_id: 'd-ulang', peran: 'pembimbing_1' as const, nilai: 50 }, { defense_id: 'd-ulang', peran: 'pembimbing_2' as const, nilai: 50 },
  ]
  const bim = bimbinganPerSidang(nb)
  assert.equal(bim.get('d-ok'), 78.5)
  assert.equal(bim.get('d-bim'), null) // one dosen only
  assert.equal(bim.has('d-gagal'), false) // nothing graded
  assert.equal(bim.get('d-rusak'), 90)
  assert.equal(bim.get('d-ulang'), 50) // another sidang of the same NPM keeps its own
  assert.deepEqual(Object.fromEntries(bimbinganPerSidang([...nb].reverse())), Object.fromEntries(bim)) // input order does not matter
  assert.equal(bimbinganPerSidang(nb, new Set(['d-bim'])).get('d-bim'), 80) // tanpa Pembimbing II: Pembimbing I alone
  assert.equal(bimbinganPerSidang(nb, new Set(['d-bim'])).get('d-ok'), 78.5) // others unchanged

  const rows = buildRekapAkhir(sidang, students, nilai, hs, bim, namaDosen)
  assert.deepEqual(rows.map((r) => r.defenseId), ['d-ok', 'd-bim', 'd-gagal', 'd-legacy', 'd-rusak']) // as given: the SQL query sorts
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
  assert.deepEqual(bm.emailDetail, gagalDetail) // the recap carries the per-address outcome
  assert.deepEqual(ok.emailDetail, []) // none stored
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
  assert.ok('alasan' in rs.hasil && rs.hasil.alasan === ALASAN_ATURAN_RUSAK) // the grading page shows this same text
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
  // email_detail from the DB is untrusted jsonb: keep only well-formed entries, never throw
  assert.deepEqual(parseDetailEmail(gagalDetail), gagalDetail)
  assert.deepEqual(parseDetailEmail(null), [])
  assert.deepEqual(parseDetailEmail('x'), [])
  assert.deepEqual(parseDetailEmail([{ alamat: 'a@b.id', status: 'gagal' }, { alamat: 1, status: 'gagal' }, { alamat: 'c', status: 'aneh' }, null]), [{ alamat: 'a@b.id', status: 'gagal' }])

  // SMTP: the phases add up to at most the 20 s race, so a send we recorded as gagal cannot deliver afterwards
  const opsi = smtpOpsi('u@x.id', 'p')
  assert.deepEqual([opsi.connectionTimeout, opsi.greetingTimeout, opsi.socketTimeout], [5000, 5000, 10000])
  assert.ok(opsi.connectionTimeout + opsi.greetingTimeout + opsi.socketTimeout <= 20_000)
  assert.deepEqual([opsi.host, opsi.port, opsi.secure], ['smtp.gmail.com', 465, true])
  console.log('nilai-sidang rekap akhir: all checks passed')
}

// ---- rekap Nilai Akhir: the xlsx
import ExcelJS from 'exceljs'
import { buildRekapAkhirXlsx } from '../src/lib/penilaian/rekap-xlsx'
void (async () => {
  const tiga = { ketua: { nama: 'Dosen K', nilai: 76.5 }, anggota_1: { nama: 'Dosen E', nilai: 76.5 }, anggota_2: { nama: 'Dosen P', nilai: null } }
  const dasar = { tanggal: '2026-11-10', judul: 'J', penguji: tiga, ipkSebelum: 2.91, hurufSidang: null, lockedAt: null, yudisium: null, emailStatus: null, emailDetail: [] }
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

// ---- Nilai Sidang recap status, and the S1 sidang menu (Penilaian dropdown)
{
  const row = (n: [number | null, number | null, number | null], o: { tanggal?: string; yudisium?: string | null; lockedAt?: string | null } = {}) => ({
    tanggal: o.tanggal ?? '2026-11-10',
    penguji: { ketua: { nama: 'K', nilai: n[0] }, anggota_1: { nama: 'A1', nilai: n[1] }, anggota_2: { nama: 'A2', nilai: n[2] } },
    yudisium: o.yudisium ?? null,
    lockedAt: o.lockedAt ?? null,
  })
  const T = '2026-11-10'
  assert.equal(statusNilaiSidang(row([null, null, null], { tanggal: '2026-11-11' }), T), 'Belum dibuka')
  assert.equal(statusNilaiSidang(row([null, 80, null], { tanggal: '2026-11-11' }), T), 'Menunggu Anggota Penguji II', 'an admin grade before the date counts')
  assert.equal(statusNilaiSidang(row([null, null, null]), T), 'Menunggu Anggota Penguji I dan Anggota Penguji II')
  assert.equal(statusNilaiSidang(row([null, 80, null]), T), 'Menunggu Anggota Penguji II')
  assert.equal(statusNilaiSidang(row([null, null, 80]), T), 'Menunggu Anggota Penguji I')
  assert.equal(statusNilaiSidang(row([null, 80, 80]), T), 'Menunggu Ketua')
  assert.equal(statusNilaiSidang(row([80, 80, 80], { yudisium: 'Lulus Dengan Revisi', lockedAt: '2026-11-10T05:00:00Z' }), T), 'Terkunci · Lulus Dengan Revisi')

  const s1 = sectionOf('/sidang/nilai-bimbingan', 's1', true, true)!
  assert.deepEqual(s1.tabs.map((t) => t.label), ['Jadwal Sidang', 'Kalender', 'Cetak'])
  assert.equal(s1.group?.label, 'Penilaian')
  assert.deepEqual(s1.group?.items.map((t) => t.href), [
    '/s1/sidang/hasil-prasidang', '/s1/sidang/nilai-sidang', '/s1/sidang/nilai-bimbingan', '/s1/sidang/nilai-akhir', '/s1/sidang/akun-eksternal',
  ])
  assert.deepEqual(sectionOf('/sidang', 's1', false, false)!.group?.items.map((t) => t.label), ['Hasil Prasidang', 'Nilai Sidang', 'Nilai Bimbingan', 'Nilai Akhir'], 'no day accounts without access')
  // Pengaturan: one dropdown of pages on every Data Master page; Penilaian only for Super Admin on S1.
  const master = sectionOf('/pengaturan/cetak', 's1', true, false)!
  assert.deepEqual(master.tabs.map((t) => t.label), ['Mata Kuliah', 'Mahasiswa', 'Sesi'])
  assert.deepEqual(master.group?.items.map((t) => t.href), ['/s1/pengaturan', '/s1/pengaturan/cetak', '/s1/pengaturan/surat', '/s1/pengaturan/ujian', '/s1/pengaturan/sidang', '/s1/pengaturan/foto-login', '/s1/pengaturan/sesi', '/s1/pengaturan/penilaian'])
  assert.equal(sectionOf('/mahasiswa', 's2', true, false)!.group?.items.some((t) => t.label === 'Penilaian'), false)
  assert.equal(sectionOf('/pengaturan/penilaian', 's1', false, false), null, 'Penilaian is not in an admin-less menu')
  assert.equal(sectionOf('/sidang', 's2', true, true)!.group, undefined, 'S2 has no grading menu')
  assert.equal(sectionOf('/sidang/nilai-sidang', 's1', false, false)!.title, 'S1 · Jadwal Prasidang & Sidang')
  console.log('nilai-sidang rekap & menu: all checks passed')
}

// ---- grafik, berita acara values, ketentuan umum
{
  assert.deepEqual(barPenguji({ anggota_1: 80 }), [{ peran: 'ketua', nilai: null }, { peran: 'anggota_1', nilai: 80 }, { peran: 'anggota_2', nilai: null }])
  assert.equal(rataRata({ ketua: 80 }), null)
  assert.equal(rataRata({ ketua: 80, anggota_2: 75 }), 77.5)
  const snap = (skor: number[], labels = ['Permasalahan', 'Presentasi']) => labels.map((label, i) => ({ label, bobot: 50, skor: skor[i] }))
  assert.deepEqual(
    barAspek([{ label: 'Permasalahan' }, { label: 'Presentasi' }], { ketua: snap([80, 70]), anggota_2: snap([60], ['Permasalahan']) }),
    [{ label: 'Permasalahan', skor: { ketua: 80, anggota_2: 60 } }, { label: 'Presentasi', skor: { ketua: 70 } }],
  )

  const beku = bekukan(DEFAULT_ATURAN)
  const ok = hasilBeritaAcara({ nilai: [78, 75, 76.5], aturan: beku, lulus: true, sks: 139, bobot: 404.57, tepatWaktu: false })
  assert.equal(ok.nilaiSidang, 76.5)
  assert.equal(ok.huruf, 'A-')
  assert.equal(ok.mutu, 3.67)
  assert.deepEqual(ok.ipk, { sks: 139, bobot: 404.57, sksSkripsi: 6, bobotSkripsi: 22.02, jumlahSks: 145, jumlahBobot: 426.59, ipkSetelah: 2.94, predikat: 'Sangat Memuaskan' })
  assert.deepEqual(hasilBeritaAcara({ nilai: [78, 75, 76.5], aturan: beku, lulus: false, sks: 139, bobot: 404.57, tepatWaktu: false }).ipk, { alasan: 'Sidang tidak lulus.' })
  assert.deepEqual(hasilBeritaAcara({ nilai: [78, 75, 76.5], aturan: beku, lulus: true, sks: null, bobot: 404.57, tepatWaktu: false }).ipk, { alasan: 'SKS/Bobot sebelum sidang belum diisi.' })

  assert.equal(DEFAULT_ATURAN.ketentuanSidang.length, 5)
  assert.notEqual(validateKetentuan([]), null)
  assert.notEqual(validateKetentuan([' ']), null)
  assert.equal(validateKetentuan(DEFAULT_ATURAN.ketentuanSidang), null)
  console.log('nilai-sidang grafik & berita acara: all checks passed')
}

// ---- berita acara xlsx
{
  const beku = bekukan(DEFAULT_ATURAN)
  const dasar = {
    npm: '2021110001', nama: 'ABDURRAHMAN', judul: 'Judul A', tanggal: '2026-11-10',
    pembimbing1: 'Dr. Satu', pembimbing2: 'Dr. Dua',
    penguji: [
      { peran: 'ketua' as const, nama: 'Ketua K', nilai: 78 },
      { peran: 'anggota_1' as const, nama: 'Anggota A1', nilai: 75 },
      { peran: 'anggota_2' as const, nama: 'Anggota A2', nilai: 76.5 },
    ],
    aturan: beku, pilihan: DEFAULT_ATURAN.pilihanYudisium, yudisium: { label: 'Lulus Dengan Revisi', lulus: true },
    sks: 139, bobot: 404.57, tepatWaktu: false,
  }
  const baca = async (d: typeof dasar) => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildBeritaAcaraXlsx(d)).buffer as ArrayBuffer)
    const ws = wb.worksheets[0]
    const rows: unknown[][] = []
    ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)))
    const cari = (label: string) => rows.find((r) => r.some((v) => v === label)) ?? []
    return { rows, cari }
  }
  void (async () => {
    const { rows, cari } = await baca(dasar)
    assert.ok(rows.some((r) => r.some((v) => String(v).includes('BERITA ACARA UJIAN SKRIPSI SARJANA (S1) PSIKOLOGI'))), 'title')
    assert.ok(cari('Ketua Penguji').includes('Ketua K') && cari('Ketua Penguji').includes(78) && cari('Ketua Penguji').includes('A-'))
    assert.ok(cari('Anggota Penguji 2').includes(76.5))
    assert.ok(cari('RATA-RATA').includes(76.5) && cari('RATA-RATA').includes('A-'), 'rata-rata = Nilai Sidang')
    assert.ok(cari('Jumlah').includes(145) && cari('Jumlah').includes(426.59))
    assert.ok(cari('IPK setelah Sidang Skripsi').includes(2.94))
    assert.ok(cari('Predikat Kelulusan').includes('Sangat Memuaskan'))
    assert.ok(cari('Lulus Dengan Revisi').includes('☒'), 'the locked yudisium is ticked')
    assert.ok(cari('Lulus Tanpa Revisi').includes('☐') && cari('Tidak Lulus').includes('☐'))
    assert.ok(cari('Dosen Pembimbing 2').includes('Dr. Dua'))
    assert.ok(!rows.some((r) => r.some((v) => /tanda tangan|ttd/i.test(String(v)))), 'no signature blocks')

    const gagal = await baca({ ...dasar, yudisium: { label: 'Tidak Lulus', lulus: false } })
    assert.ok(gagal.cari('IPK setelah Sidang Skripsi').includes('Sidang tidak lulus.'))
    assert.ok(!gagal.rows.some((r) => r.some((v) => typeof v === 'number' && Number.isNaN(v))), 'never NaN')
    console.log('nilai-sidang berita acara xlsx: all checks passed')
  })().catch((e) => { console.error(e); process.exit(1) })
}

// ---- final review fixes: live channel status, renamed yudisium
{
  // Every (re)subscribe refreshes, so grades sent while disconnected show up; errors show the note.
  assert.deepEqual(aksiKanal('SUBSCRIBED'), { putus: false, segarkan: true })
  assert.deepEqual(aksiKanal('CHANNEL_ERROR'), { putus: true, segarkan: false })
  assert.deepEqual(aksiKanal('TIMED_OUT'), { putus: true, segarkan: false })
  assert.deepEqual(aksiKanal('CLOSED'), { putus: true, segarkan: false })
  assert.notEqual(topikKanal('d1'), topikKanal('d1'), 'a fresh topic per mount: never reuse a channel still leaving')
  assert.ok(topikKanal('d1').startsWith('sidang-d1-'))

  void (async () => {
    const wb = new ExcelJS.Workbook()
    const beku = bekukan(DEFAULT_ATURAN)
    await wb.xlsx.load((await buildBeritaAcaraXlsx({
      npm: '1', nama: 'A', judul: '', tanggal: '2026-11-10', pembimbing1: null, pembimbing2: null,
      penguji: [{ peran: 'ketua', nama: 'K', nilai: 80 }, { peran: 'anggota_1', nama: 'A1', nilai: 80 }, { peran: 'anggota_2', nama: 'A2', nilai: 80 }],
      aturan: beku, pilihan: DEFAULT_ATURAN.pilihanYudisium, yudisium: { label: 'Lulus (nama lama)', lulus: true },
      sks: 139, bobot: 404.57, tepatWaktu: true,
    })).buffer as ArrayBuffer)
    const rows: unknown[][] = []
    wb.worksheets[0].eachRow((r) => rows.push((r.values as unknown[]).slice(1)))
    assert.ok(rows.some((r) => r[0] === 'Lulus (nama lama)' && r[1] === '☒'), 'a yudisium renamed after the lock is still printed, ticked')
    console.log('nilai-sidang review fixes: all checks passed')
  })().catch((e) => { console.error(e); process.exit(1) })
}
