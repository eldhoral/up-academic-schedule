import Link from 'next/link'

type Tab = { href: string; label: string }
type Section = { title: string; tabs: Tab[] }

const KULIAH: Section = {
  title: 'Jadwal Mata Kuliah & Dosen',
  tabs: [
    { href: '/kuliah', label: 'Penjadwalan' },
    { href: '/kuliah/kalender', label: 'Kalender' },
    { href: '/kuliah/cetak', label: 'Cetak Jadwal' },
    { href: '/kuliah/rekap', label: 'Rekap Dosen' },
  ],
}

const UJIAN: Section = {
  title: 'Jadwal UTS & UAS',
  tabs: [{ href: '/ujian', label: 'Jadwal Ujian' }],
}

const MASTER: Section = {
  title: 'Data Master',
  tabs: [
    { href: '/mata-kuliah', label: 'Mata Kuliah' },
    { href: '/dosen', label: 'Dosen' },
    { href: '/ruangan', label: 'Ruangan' },
    { href: '/sesi', label: 'Sesi' },
    { href: '/tahun-akademik', label: 'Tahun Akademik' },
    { href: '/pengaturan', label: 'Pengaturan' },
  ],
}

/** The section a page belongs to; null on the menu itself ("/"). */
function sectionOf(active: string): Section | null {
  if (active.startsWith('/kuliah')) return KULIAH
  if (active.startsWith('/ujian')) return UJIAN
  if (MASTER.tabs.some((t) => t.href === active)) return MASTER
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
export function HeaderNav({ active }: { active: string }) {
  const section = sectionOf(active)
  if (!section) return null

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
          aria-current={tab.href === active ? 'page' : undefined}
          className={linkClass(tab.href === active)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
