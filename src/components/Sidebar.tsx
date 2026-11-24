import Image from 'next/image'
import Link from 'next/link'
import { signOutAction } from '@/app/actions/auth'
import { getCurrentUser, ROLE_LABEL, type Role } from '@/lib/roles'
import type { Prodi, ProdiAccess } from '@/lib/prodi'
import { sidebarModel, type IkonSidebar } from './sidebar-model'
import { TextSizeController } from './TextSizeController'

function SidebarIcon({ ikon, aktif }: { ikon: IkonSidebar; aktif: boolean }) {
  const strokeClass = aktif ? 'text-[var(--aksen)]' : 'text-[var(--tinta-3)]'
  const common = `w-5 h-5 shrink-0 ${strokeClass}`

  switch (ikon) {
    case 'beranda':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5H9v5a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        </svg>
      )
    case 'kuliah':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    case 'ujian':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    case 'sidang':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      )
    case 'penilaian':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'master':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      )
    case 'kalender':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'bersama':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    case 'pengguna':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    case 'log':
      return (
        <svg className={common} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

export type SidebarProps = {
  active: string
  prodi?: Prodi
  user?: {
    email: string
    role: Role
    prodiAccess: ProdiAccess
  } | null
  phone?: boolean
  className?: string
}

export async function Sidebar({
  active,
  prodi,
  user: initialUser,
  phone = false,
  className = '',
}: SidebarProps) {
  const user = initialUser ?? (await getCurrentUser())
  const email = user?.email || 'Admin'
  const role: Role = user?.role ?? 'VIEWER'
  const roleLabel = ROLE_LABEL[role] ?? 'Staf'
  const initials = (email.slice(0, 2) || 'AD').toUpperCase()
  const prodiAccess: ProdiAccess = user?.prodiAccess ?? 's1'
  const groups = sidebarModel({ active, prodi, role, prodiAccess })

  return (
    <nav
      aria-label="Menu utama"
      className={`no-print flex flex-col h-full bg-[var(--sidebar)] border-r border-[var(--garis)] text-[var(--tinta)] ${className}`}
    >
      {/* Logos */}
      <div className="flex items-center justify-center py-[1rem] px-[1rem] border-b border-[var(--garis)] shrink-0">
        <Link href="/" className="flex items-center justify-center gap-[0.6rem]">
          <Image
            src="/images/logo-universitas-pancasila.png"
            alt="Universitas Pancasila"
            width={64}
            height={64}
            className={`${phone ? 'h-[48px]' : 'h-[52px]'} w-auto`}
          />
          <span className="w-px h-[2rem] bg-[var(--garis-kuat)]" aria-hidden="true" />
          <Image
            src="/images/logo-fakultas-psikologi.png"
            alt="Fakultas Psikologi"
            width={64}
            height={64}
            className={`${phone ? 'h-[48px]' : 'h-[52px]'} w-auto`}
          />
          <span className="sr-only">Beranda</span>
        </Link>
      </div>

      {/* Account chip and navigation groups */}
      <div className="flex-1 overflow-y-auto p-[0.75rem] space-y-[0.75rem]">
        {/* Account chip */}
        <div className="p-[0.6rem] rounded-[var(--r-item)] bg-[var(--cekung)] border border-[var(--garis)] flex items-center gap-[0.6rem]">
          <div
            className="w-[2.2rem] h-[2.2rem] rounded-full bg-[var(--aksen-lembut)] text-[var(--aksen)] font-semibold text-[0.82rem] flex items-center justify-center shrink-0 uppercase"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[0.85rem] font-medium text-[var(--tinta)] truncate" title={email}>
              {email}
            </div>
            <div className="text-[0.75rem] text-[var(--tinta-3)] truncate">
              {roleLabel}
            </div>
          </div>
        </div>

        {/* Groups */}
        <div className="space-y-[0.75rem]">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-[0.15rem]">
              {group.judul && (
                <div className="px-[0.75rem] pt-[0.4rem] pb-[0.2rem] text-[0.72rem] font-semibold uppercase tracking-wider text-[var(--tinta-3)]">
                  {group.judul}
                </div>
              )}
              <ul className="list-none m-0 p-0 space-y-[0.15rem]">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.aktif ? 'page' : undefined}
                      className={`flex items-center gap-[0.65rem] px-[0.75rem] min-h-[44px] rounded-[var(--r-item)] text-[0.87rem] transition-colors ${
                        item.aktif
                          ? 'bg-[var(--aksen-lembut)] text-[var(--aksen)] font-medium'
                          : 'text-[var(--tinta)] hover:bg-[var(--cekung)]'
                      }`}
                    >
                      <SidebarIcon ikon={item.ikon} aktif={item.aktif} />
                      <span className="truncate">{item.label}</span>
                    </Link>

                    {item.anak && item.anak.length > 0 && item.aktif && (
                      <ul className="list-none m-0 pl-[2.4rem] pr-[0.4rem] pt-[0.15rem] pb-[0.25rem] space-y-[0.15rem]">
                        {item.anak.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={child.aktif ? 'page' : undefined}
                              className={`block min-h-[36px] flex items-center px-[0.6rem] py-[0.25rem] rounded-[var(--r-item)] text-[0.82rem] transition-colors ${
                                child.aktif
                                  ? 'bg-[var(--aksen-lembut)] text-[var(--aksen)] font-medium'
                                  : 'text-[var(--tinta-2)] hover:bg-[var(--cekung)] hover:text-[var(--tinta)]'
                              }`}
                            >
                              <span className="truncate">{child.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-[0.75rem] border-t border-[var(--garis)] space-y-[0.6rem] shrink-0 mt-auto bg-[var(--sidebar)]">
        <div className="flex items-center justify-between">
          <TextSizeController />
        </div>
        <div className="flex items-center justify-between pt-[0.4rem] border-t border-[var(--garis)] text-[0.82rem]">
          {user?.role !== 'EKSTERNAL' ? (
            <Link
              href="/atur-kata-sandi"
              className="text-[var(--biru)] hover:underline whitespace-nowrap"
            >
              Ganti kata sandi
            </Link>
          ) : (
            <span />
          )}
          <form action={signOutAction} className="ml-auto">
            <button
              type="submit"
              title={email ? `Keluar dari ${email}` : 'Keluar'}
              className="min-h-[2.2rem] px-[0.65rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)] cursor-pointer text-[0.82rem] whitespace-nowrap"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </nav>
  )
}
