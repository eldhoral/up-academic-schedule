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
    const res = await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20')
    assert.ok(res.created && res.username === 'eks-ext01-201126' && res.password.length === 10)
    assert.ok(log.includes('createUser(eks-ext01-201126@penguji.local)'), log.join('\n'))
    assert.ok(log.some((l) => l.startsWith('profiles.update(') && l.includes('"role":"EKSTERNAL"') && l.includes('"kode_dosen":"EXT-01"') && l.includes('"berlaku_sampai":"2026-11-21"')), log.join('\n'))
    assert.ok(log.some((l) => l.startsWith('akun_eksternal.insert(') && l.includes('"username":"eks-ext01-201126"')), log.join('\n'))
    assert.ok(!log.some((l) => l.startsWith('deleteUser')))
  }
  // Exists: no new user, berlaku_sampai only ever raised to tanggal + 1.
  {
    const { admin, log } = fakeAdmin({ ada: { data: { user_id: 'u-lama' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'), { created: false })
    assert.ok(!log.some((l) => l.startsWith('createUser')))
    assert.ok(log.includes('profiles.lt("berlaku_sampai","2026-11-21")'), log.join('\n'))
  }
  // Profile update fails: the VIEWER user is deleted, the error surfaces.
  {
    const { admin, log } = fakeAdmin({ profil: { error: { message: 'boom' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'))
    assert.ok(log.includes('deleteUser(u-baru)'))
  }
  // ...and a failed delete is reported too, naming the leftover login.
  {
    const { admin } = fakeAdmin({ profil: { error: { message: 'boom' } }, hapus: { error: { message: 'down' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'), /eks-ext01-201126/)
  }
  // Race lost on the akun row (23505): clean up our user, treat as existing.
  {
    const { admin, log } = fakeAdmin({ insert: { error: { message: 'dup', code: '23505' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'), { created: false })
    assert.ok(log.includes('deleteUser(u-baru)'))
  }
  // Race lost on the login itself (same username): nothing to clean up, treat as existing.
  {
    const { admin, log } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } } })
    assert.deepEqual(await ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'), { created: false })
    assert.ok(!log.some((l) => l.startsWith('deleteUser')))
  }
  // ...unless that username belongs to another dosen (kodes that normalize alike).
  {
    const { admin } = fakeAdmin({ create: { data: null, error: { message: 'exists', code: 'email_exists' } }, pemilik: { data: { kode_dosen: 'EXT01' } } })
    await assert.rejects(ensureAkunEksternal(admin, 'EXT-01', '2026-11-20'), /dosen lain/)
  }
  console.log('nilai-sidang akun eksternal: all checks passed')
}
cekEnsure().catch((e) => { console.error(e); process.exit(1) })
