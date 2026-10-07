import Link from 'next/link'
import { PRODI_CONFIG, type Prodi } from '@/lib/prodi'

type Tab = { href: string; label: string }
type Section = { title: string; tabs: Tab[] }

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
  { href: '/pengaturan', label: 'Pengaturan' },
]

const MASTER_SHARED: Tab[] = [
  { href: '/dosen', label: 'Dosen' },
  { href: '/ruangan', label: 'Ruangan' },
  { href: '/tahun-akademik', label: 'Tahun Akademik' },
]

/** The section a page belongs to; null on the menu itself ("/"). */
function sectionOf(active: string, prodi: Prodi | undefined): Section | null {
  if (prodi) {
    const c = PRODI_CONFIG[prodi]
    const own = (title: string, tabs: Tab[]) => ({ title: `${c.short} · ${title}`, tabs: tabs.map((t) => ({ ...t, href: `/${prodi}${t.href}` })) })
    if (active.startsWith('/kuliah')) return own('Jadwal Mata Kuliah & Dosen', KULIAH)
    if (active.startsWith('/ujian')) return own('Jadwal UTS & UAS', UJIAN)
    if (active.startsWith('/sidang')) return own(`Jadwal ${c.defense.section}`, SIDANG.map((t) => (t.href === '/sidang' ? { ...t, label: `Jadwal ${c.defense.sidang}` } : t)))
    if (MASTER_PRODI.some((t) => t.href === active)) return own('Data Master', MASTER_PRODI)
  }
  if (MASTER_SHARED.some((t) => t.href === active)) return { title: 'Data Bersama', tabs: MASTER_SHARED }
  if (active === '/pengguna') return { title: 'Manajemen Pengguna', tabs: [] }
  if (active === '/log-aktivitas') return { title: 'Audit Log', tabs: [] }
  return null
}

const linkClass = (isActive: boolean) =>
  `block px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.93rem] transition-colors ${
    isActive
      ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-medium'
      : 'text-[var(--tinta)] hover:bg-[var(--cekung)]'
  }`

/** Back to the menu, the section's name, and its tabs. Nothing on the menu itself. */
export function HeaderNav({ active, prodi }: { active: string; prodi?: Prodi }) {
  const section = sectionOf(active, prodi)
  if (!section) return null
  const current = prodi ? `/${prodi}${active}` : active

  return (
    <nav className="flex items-center gap-[0.13rem] flex-wrap" aria-label="Navigasi bagian">
      <Link href="/" className={`${linkClass(false)} text-[var(--tinta-2)]`}>
        ‹ Menu
      </Link>
      <span className="px-[0.6rem] text-[0.93rem] font-semibold text-[var(--tinta)]">{section.title}</span>
      {section.tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? 'page' : undefined}
          className={linkClass(tab.href === current)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
