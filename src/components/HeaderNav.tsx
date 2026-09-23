'use client'

import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const PRIMARY_NAV = [
  { href: '/', label: 'Penjadwalan' },
  { href: '/kalender', label: 'Kalender' },
]

const DATA_NAV = [
  { href: '/mata-kuliah', label: 'Mata Kuliah' },
  { href: '/dosen', label: 'Dosen' },
  { href: '/ruangan', label: 'Ruangan' },
  { href: '/sesi', label: 'Sesi' },
  { href: '/tahun-akademik', label: 'Tahun Akademik' },
  { href: '/pengaturan', label: 'Pengaturan' },
]

const CETAK_NAV = [
  { href: '/cetak', label: 'Cetak Jadwal' },
  { href: '/rekap', label: 'Rekap Dosen' },
]

const linkClass = (isActive: boolean) =>
  `block px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.93rem] transition-colors ${
    isActive
      ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-medium'
      : 'text-[var(--tinta)] hover:bg-[var(--cekung)]'
  }`

export function HeaderNav({ active }: { active: string }) {
  return (
    <nav className="flex items-center gap-[0.13rem]" aria-label="Navigasi utama">
      {PRIMARY_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? 'page' : undefined}
          className={linkClass(item.href === active)}
        >
          {item.label}
        </Link>
      ))}

      <NavGroup label="Data Master" items={DATA_NAV} active={active} />
      <NavGroup label="Cetak & Rekap" items={CETAK_NAV} active={active} />
    </nav>
  )
}

function NavGroup({
  label,
  items,
  active,
}: {
  label: string
  items: { href: string; label: string }[]
  active: string
}) {
  const isGroupActive = items.some((item) => item.href === active)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={`inline-flex items-center gap-[0.27rem] cursor-pointer ${linkClass(isGroupActive)}`}>
        {label}
        <ChevronDown />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[60] min-w-[11rem] p-[0.27rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)]"
        >
          {items.map((item) => (
            <DropdownMenu.Item key={item.href} asChild>
              <Link
                href={item.href}
                aria-current={item.href === active ? 'page' : undefined}
                className={`block px-[0.6rem] py-[0.33rem] rounded-[var(--r-kecil)] text-[0.93rem] outline-none cursor-pointer transition-colors ${
                  item.href === active
                    ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-medium'
                    : 'text-[var(--tinta-2)] data-[highlighted]:bg-[var(--cekung)] data-[highlighted]:text-[var(--tinta)]'
                }`}
              >
                {item.label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ChevronDown() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
