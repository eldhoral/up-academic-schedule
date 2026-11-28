import assert from 'node:assert/strict'
import { sidebarModel, type GrupSidebar } from '../src/components/sidebar-model'

const sa = sidebarModel({ active: '/', role: 'SUPERADMIN', prodiAccess: 'all' })
assert.deepEqual(sa.map((g) => g.judul), [null, 'S1 Psikologi', 'S2 Psikologi', null, null])
assert.deepEqual(sa[0].items.map((i) => [i.href, i.aktif]), [['/', true]])
assert.deepEqual(sa[1].items.map((i) => i.href), ['/s1/kuliah', '/s1/ujian', '/s1/sidang', '/s1/sidang/hasil-prasidang', '/s1/mata-kuliah'])
assert.equal(sa[1].items[2].label, 'Jadwal Prasidang & Sidang')
assert.deepEqual(sa[1].items[3].anak!.map((a) => a.label), ['Hasil Prasidang', 'Nilai Sidang', 'Nilai Bimbingan', 'Nilai Akhir', 'Akun Penguji Eksternal'])
assert.deepEqual(sa[2].items.map((i) => i.href), ['/s2/kuliah', '/s2/ujian', '/s2/sidang', '/s2/sidang/hasil-prasidang', '/s2/mata-kuliah'], 'S2 has Penilaian too (kiprat 2026-11-27)')
assert.deepEqual(sa[2].items[3].anak!.map((a) => a.label), ['Hasil Seminar Proposal', 'Nilai Tesis', 'Nilai Bimbingan', 'Nilai Akhir', 'Akun Penguji Eksternal'])
assert.equal(sa[2].items[2].label, 'Jadwal Seminar Proposal & Tesis')
assert.deepEqual(sa[3].items.map((i) => i.href), ['/kalender', '/dosen'])
assert.deepEqual(sa[4].items.map((i) => i.href), ['/pengguna', '/log-aktivitas'])
// Only one prodi; no Pengguna, no Akun Penguji Eksternal for a Pemantau.
const viewerS2 = sidebarModel({ active: '/', role: 'VIEWER', prodiAccess: 's2' })
assert.deepEqual(viewerS2.map((g) => g.judul), [null, 'S2 Psikologi', null, null])
assert.deepEqual(viewerS2.at(-1)!.items.map((i) => i.href), ['/log-aktivitas'])
const viewerS1 = sidebarModel({ active: '/', role: 'VIEWER', prodiAccess: 's1' })
assert.ok(!viewerS1[1].items.find((i) => i.ikon === 'penilaian')!.anak!.some((a) => a.label === 'Akun Penguji Eksternal'))
// Highlighting: the item owning the page.
const aktif = (m: GrupSidebar[]) => m.flatMap((g) => g.items).filter((i) => i.aktif).map((i) => i.href)
assert.deepEqual(aktif(sidebarModel({ active: '/ujian/kalender', prodi: 's1', role: 'SCHEDULER', prodiAccess: 'all' })), ['/s1/ujian'])
assert.deepEqual(aktif(sidebarModel({ active: '/sidang/nilai-akhir', prodi: 's1', role: 'SCHEDULER', prodiAccess: 'all' })), ['/s1/sidang/hasil-prasidang'])
assert.deepEqual(aktif(sidebarModel({ active: '/sidang/kalender', prodi: 's1', role: 'SCHEDULER', prodiAccess: 'all' })), ['/s1/sidang'])
assert.deepEqual(aktif(sidebarModel({ active: '/pengaturan/cetak', prodi: 's2', role: 'SUPERADMIN', prodiAccess: 'all' })), ['/s2/mata-kuliah'])
assert.deepEqual(aktif(sidebarModel({ active: '/nilai-sidang/abc', prodi: 's1', role: 'SCHEDULER', prodiAccess: 'all' })), ['/s1/sidang/hasil-prasidang'])
// A grading page lights its own defense's prodi only.
assert.deepEqual(aktif(sidebarModel({ active: '/nilai-sidang/abc', prodi: 's2', role: 'SCHEDULER', prodiAccess: 'all' })), ['/s2/sidang/hasil-prasidang'])
for (const p of ['/dosen', '/ruangan', '/tahun-akademik']) assert.deepEqual(aktif(sidebarModel({ active: p, role: 'SUPERADMIN', prodiAccess: 'all' })), ['/dosen'])
assert.deepEqual(aktif(sidebarModel({ active: '/log-aktivitas/riwayat', role: 'SUPERADMIN', prodiAccess: 'all' })), ['/log-aktivitas'])

console.log('sidebar: all checks passed')
