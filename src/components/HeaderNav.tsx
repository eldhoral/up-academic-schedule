import Link from 'next/link'
import type { Prodi } from '@/lib/prodi'
import { linkClass, sectionOf } from './nav-sections'
import { NavDropdown } from './NavDropdown'

/** Back to the menu, the section's name, and its tabs. Nothing on the menu itself. */
export function HeaderNav({ active, prodi, canManage = false, akunEksternal = false }: { active: string; prodi?: Prodi; canManage?: boolean; akunEksternal?: boolean }) {
  const section = sectionOf(active, prodi, canManage, akunEksternal)
  if (!section) return null
  const current = prodi ? `/${prodi}${active}` : active

  return (
    <nav className="flex items-center gap-[0.13rem] flex-wrap" aria-label="Navigasi bagian">
      <span className="pr-[0.667rem] text-[0.933rem] font-semibold text-[var(--tinta)]">{section.title}</span>
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
      {section.group && <NavDropdown label={section.group.label} items={section.group.items} current={current} />}
    </nav>
  )
}
