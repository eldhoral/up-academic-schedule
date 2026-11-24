import { PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { BAGIAN_PENGATURAN, pengaturanHref } from '@/lib/pengaturan-bagian'

export type Tab = { href: string; label: string }
/** group: pages shown as one dropdown after the tabs (S1 grading pages, the Pengaturan pages). */
export type Section = { title: string; tabs: Tab[]; group?: { label: string; items: Tab[] } }

// Tab hrefs are prodi-less; a prodi page prefixes them with /s1 or /s2.
const KULIAH: Tab[] = [
  { href: '/kuliah', label: 'Penjadwalan' },
  { href: '/kuliah/kalender', label: 'Kalender' },
  { href: '/kuliah/cetak', label: 'Cetak Jadwal' },
  { href: '/kuliah/rekap', label: 'Rekap Dosen' },
]

const UJIAN: Tab[] = [
  { href: '/ujian', label: 'Jadwal Ujian' },
  { href: '/ujian/kalender', label: 'Kalender' },
  { href: '/ujian/cetak', label: 'Cetak' },
  { href: '/ujian/rekap', label: 'Rekap Pengawas' },
]

const SIDANG: Tab[] = [
  { href: '/sidang', label: 'Jadwal Sidang' },
  { href: '/sidang/kalender', label: 'Kalender' },
  { href: '/sidang/cetak', label: 'Cetak' },
]

const MASTER_PRODI: Tab[] = [
  { href: '/mata-kuliah', label: 'Mata Kuliah' },
  { href: '/mahasiswa', label: 'Mahasiswa' },
  { href: '/sesi', label: 'Sesi' },
]

// S1 only, under the "Penilaian" dropdown: the prasidang berita acara and the sidang grading recaps.
const HASIL_PRASIDANG: Tab = { href: '/sidang/hasil-prasidang', label: 'Hasil Prasidang' }

const NILAI_SIDANG: Tab = { href: '/sidang/nilai-sidang', label: 'Nilai Sidang' }

const NILAI_BIMBINGAN: Tab = { href: '/sidang/nilai-bimbingan', label: 'Nilai Bimbingan' }

const NILAI_AKHIR: Tab = { href: '/sidang/nilai-akhir', label: 'Nilai Akhir' }

// Super Admin and Penjadwal, S1 only: day logins for external sidang examiners.
const AKUN_EKSTERNAL: Tab = { href: '/sidang/akun-eksternal', label: 'Akun Penguji Eksternal' }

// Super Admin only, S1 only (online grading is S1 prasidang).
const PENILAIAN: Tab = { href: '/pengaturan/penilaian', label: 'Penilaian' }

const MASTER_SHARED: Tab[] = [
  { href: '/dosen', label: 'Dosen' },
  { href: '/ruangan', label: 'Ruangan' },
  { href: '/tahun-akademik', label: 'Tahun Akademik' },
]

/** The section a page belongs to; null on the menu itself ("/"). */
export function sectionOf(active: string, prodi: Prodi | undefined, canManage: boolean, akunEksternal: boolean): Section | null {
  if (prodi) {
    const c = PRODI_CONFIG[prodi]
    const pre = (tabs: Tab[]) => tabs.map((t) => ({ ...t, href: `/${prodi}${t.href}` }))
    const own = (title: string, tabs: Tab[]): Section => ({ title: `${c.short} · ${title}`, tabs: pre(tabs) })
    if (active.startsWith('/kuliah')) return own('Jadwal Mata Kuliah & Dosen', KULIAH)
    if (active.startsWith('/ujian')) return own('Jadwal UTS & UAS', UJIAN)
    if (active.startsWith('/sidang')) {
      const tabs = SIDANG.map((t) => (t.href === '/sidang' ? { ...t, label: `Jadwal ${c.defense.sidang}` } : t))
      const section = own(`Jadwal ${c.defense.section}`, tabs)
      if (prodi !== 's1') return section
      const nilai = [HASIL_PRASIDANG, NILAI_SIDANG, NILAI_BIMBINGAN, NILAI_AKHIR, ...(akunEksternal ? [AKUN_EKSTERNAL] : [])]
      return { ...section, group: { label: 'Penilaian', items: pre(nilai) } }
    }
    const pengaturan: Tab[] = [
      ...BAGIAN_PENGATURAN.map((b) => ({ href: pengaturanHref(b.slug), label: b.slug === 'sidang' ? `Jadwal ${c.defense.section}` : b.label })),
      ...(canManage && prodi === 's1' ? [PENILAIAN] : []),
    ]
    if ([...MASTER_PRODI, ...pengaturan].some((t) => t.href === active)) {
      return { ...own('Data Master', MASTER_PRODI), group: { label: 'Pengaturan', items: pre(pengaturan) } }
    }
  }
  if (MASTER_SHARED.some((t) => t.href === active)) return { title: 'Data Bersama', tabs: MASTER_SHARED }
  if (active === '/kalender') return { title: 'Kalender Gabungan', tabs: [] }
  if (active === '/pengguna') return { title: 'Manajemen Pengguna', tabs: [] }
  if (active === '/log-aktivitas') return { title: 'Audit Log', tabs: [] }
  if (active === '/atur-kata-sandi') return { title: 'Ganti Kata Sandi', tabs: [] }
  return null
}

/** `geser`: the active highlight is a separate PilGeser layer (class PIL_TAB) that slides between tabs on navigation. */
export const linkClass = (isActive: boolean, geser = false) =>
  `block px-[0.667rem] py-[0.4rem] rounded-[8px] text-[0.933rem] transition-colors ${
    isActive
      ? `text-[var(--aksen)] font-medium ${geser ? 'relative isolate' : 'bg-[var(--aksen-lembut)]'}`
      : 'text-[var(--tinta)] hover:bg-[var(--cekung)]'
  }`

export const PIL_TAB = 'absolute inset-0 -z-10 rounded-[8px] bg-[var(--aksen-lembut)]'

