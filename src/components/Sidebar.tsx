import Image from 'next/image'
import Link from 'next/link'
import { Fragment } from 'react'
import { signOutAction } from '@/app/actions/auth'
import { namaLogin } from '@/lib/login'
import { getCurrentUser, ROLE_LABEL, type Role } from '@/lib/roles'
import type { Prodi, ProdiAccess } from '@/lib/prodi'
import { sidebarModel, type IkonSidebar } from './sidebar-model'
import { TextSizeController } from './TextSizeController'

/*
 * Mirrors Final-Beranda.dc.html. Sizes are the mockup's px divided by 15 (the app's default root size),
 * so they match at the default text size and still grow with the Ukuran teks buttons.
 */

/** Stroke icons from the mockup, 17px, inheriting the item's colour. */
const IKON: Record<IkonSidebar, React.ReactNode> = {
  beranda: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  kuliah: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  ujian: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </>
  ),
  sidang: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </>
  ),
  penilaian: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  master: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  kalender: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18" />
      <circle cx="8" cy="15" r="1" />
      <circle cx="12" cy="15" r="1" />
    </>
  ),
  bersama: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
      <circle cx="17" cy="9" r="3" />
      <path d="M17 15c3 0 5 2 5 5" />
    </>
  ),
  pengguna: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
      <path d="M17 11h5M19.5 8.5v5" />
    </>
  ),
  log: <path d="M3 12h4l3-8 4 16 3-8h4" />,
}

const ITEM = 'flex items-center gap-[0.667rem] min-h-[2.667rem] px-[0.667rem] rounded-[var(--r-item)] text-[0.933rem] no-underline'
const ITEM_AKTIF = 'bg-[var(--aksen-lembut)] text-[var(--aksen)] font-semibold'
const ITEM_BIASA = 'text-[var(--tinta-2)] hover:bg-[var(--cekung)]'

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

export async function Sidebar({ active, prodi, user: initialUser, phone = false, className = '' }: SidebarProps) {
  const user = initialUser ?? (await getCurrentUser())
  const nama = user?.email ? namaLogin(user.email) : 'Admin'
  const role: Role = user?.role ?? 'VIEWER'
  const groups = sidebarModel({ active, prodi, role, prodiAccess: user?.prodiAccess ?? 's1' })
  const logo = phone ? 'h-[48px]' : 'h-[52px]'

  return (
    <nav
      aria-label="Menu utama"
      className={`no-print flex flex-col gap-[1.2rem] overflow-y-auto leading-[normal] bg-[var(--sidebar)] border-r border-[var(--garis)] px-[0.933rem] py-[1.333rem] text-[var(--tinta)] ${className}`}
    >
      <Link href="/" aria-label="Beranda" className="flex items-center justify-center gap-[0.933rem] py-[0.4rem]">
        <Image src="/images/logo-universitas-pancasila.png" alt="Universitas Pancasila" width={64} height={64} className={`${logo} w-auto`} />
        <span aria-hidden="true" className="h-[40px] w-px bg-[var(--garis-kuat)]" />
        <Image src="/images/logo-fakultas-psikologi.png" alt="Fakultas Psikologi" width={64} height={64} className={`${logo} w-auto`} />
      </Link>

      <div className="flex items-center gap-[0.667rem] rounded-[var(--r-item)] bg-[var(--cekung)] p-[0.667rem]">
        <span aria-hidden="true" className="flex size-[2.267rem] shrink-0 items-center justify-center rounded-full bg-[var(--aksen-lembut)] text-[0.867rem] font-semibold text-[var(--aksen)] uppercase">
          {nama.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[0.933rem] font-semibold" title={nama}>
            {nama}
          </div>
          <div className="text-[0.8rem] text-[var(--tinta-3)]">{ROLE_LABEL[role] ?? 'Staf'}</div>
        </div>
      </div>

      <div className="flex flex-col gap-[0.133rem]">
        {groups.map((group, g) => (
          <Fragment key={g}>
            {group.judul ? (
              <div className="px-[0.667rem] pt-[0.933rem] pb-[0.267rem] text-[0.733rem] font-semibold uppercase tracking-[0.06em] text-[var(--tinta-3)]">
                {group.judul}
              </div>
            ) : (
              g > 0 && groups[g - 1].judul && <div aria-hidden="true" className="mx-[0.4rem] my-[0.8rem] h-px bg-[var(--garis)]" />
            )}
            {group.items.map((item) => {
              const buka = !!item.anak?.length && item.aktif
              return (
                <Fragment key={item.href}>
                  <Link href={item.href} aria-current={item.aktif ? 'page' : undefined} className={`${ITEM} ${item.aktif ? ITEM_AKTIF : ITEM_BIASA}`}>
                    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      {IKON[item.ikon]}
                    </svg>
                    {item.anak?.length ? (
                      <>
                        <span className="grow">{item.label}</span>
                        <span aria-hidden="true">{buka ? '⌄' : '›'}</span>
                      </>
                    ) : (
                      item.label
                    )}
                  </Link>
                  {buka && (
                    <div className="mt-[0.133rem] mb-[0.267rem] ml-[1.733rem] flex flex-col gap-px border-l border-[var(--garis)] pl-[0.667rem]">
                      {item.anak!.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={child.aktif ? 'page' : undefined}
                          className={`flex min-h-[2.267rem] items-center rounded-[8px] px-[0.667rem] text-[0.867rem] no-underline ${
                            child.aktif ? 'font-semibold text-[var(--aksen)]' : 'text-[var(--tinta-2)] hover:bg-[var(--cekung)]'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-[0.667rem] border-t border-[var(--garis)] pt-[0.933rem]">
        <TextSizeController ringkas />
        <div className="flex gap-[0.533rem]">
          {user?.role !== 'EKSTERNAL' && (
            <Link href="/atur-kata-sandi" className="flex min-h-[2.667rem] grow items-center px-[0.667rem] text-[0.867rem] text-[var(--aksen)] no-underline hover:underline">
              Ganti kata sandi
            </Link>
          )}
          <form action={signOutAction} className="ml-auto">
            <button
              type="submit"
              title={`Keluar dari ${nama}`}
              className="min-h-[2.667rem] cursor-pointer rounded-[8px] border border-[var(--garis-kuat)] bg-[var(--lembar)] px-[0.933rem] text-[0.867rem] text-[var(--tinta-2)] hover:bg-[var(--cekung)]"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </nav>
  )
}
