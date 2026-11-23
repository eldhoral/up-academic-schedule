import Image from 'next/image'
import Link from 'next/link'
import { signOutAction } from '@/app/actions/auth'
import type { Prodi, ProdiAccess } from '@/lib/prodi'
import { ROLE_LABEL, type Role } from '@/lib/role-types'
import { TextSizeController } from './TextSizeController'
import { sidebarModel, type IkonSidebar, type ItemSidebar } from './sidebar-model'

/** The staff navigation: server-rendered, rendered as-is inside the phone overlay. */
export function Sidebar({
  active,
  prodi,
  role,
  prodiAccess,
  email,
}: {
  active: string
  prodi?: Prodi
  role: Role
  prodiAccess: ProdiAccess
  email: string | null
}) {
  const groups = sidebarModel({ active, prodi, role, prodiAccess })

  return (
    <nav
      aria-label="Menu utama"
      className="no-print flex h-full w-[15rem] shrink-0 flex-col overflow-y-auto bg-[var(--sidebar)] px-[0.7rem] py-[0.9rem] text-[var(--tinta)]"
    >
      <Link href="/" className="flex items-center justify-center gap-[0.4rem] px-[0.3rem]">
        <Image src="/images/logo-universitas-pancasila.png" alt="Universitas Pancasila" width={64} height={64} className="h-[1.9rem] w-auto" />
        <span className="h-[1.5rem] w-px bg-[var(--garis-kuat)]" aria-hidden="true" />
        <Image src="/images/logo-fakultas-psikologi.png" alt="Fakultas Psikologi" width={64} height={64} className="h-[1.9rem] w-auto" />
      </Link>

      <div className="mt-[1rem] min-w-0 rounded-[var(--r-item)] bg-[var(--cekung)] px-[0.7rem] py-[0.5rem]">
        <p className="m-0 truncate text-[0.83rem] font-medium" title={email ?? ''}>{email || 'Admin'}</p>
        <p className="m-0 text-[0.75rem] text-[var(--tinta-3)]">{ROLE_LABEL[role]}</p>
      </div>

      <div className="mt-[1rem] flex flex-col gap-[0.85rem]">
        {groups.map((group, i) => (
          <div key={`${group.judul ?? 'grup'}-${i}`}>
            {group.judul && (
              <p className="m-0 mb-[0.25rem] px-[0.7rem] text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[var(--tinta-3)]">
                {group.judul}
              </p>
            )}
            <ul className="m-0 list-none space-y-[0.1rem] p-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <ItemLink item={item} />
                  {item.anak && item.aktif && (
                    <ul className="m-0 ml-[2.1rem] list-none space-y-[0.05rem] p-0">
                      {item.anak.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={child.aktif ? 'page' : undefined}
                            className={`block min-h-[2rem] rounded-[var(--r-item)] px-[0.6rem] py-[0.3rem] text-[0.82rem] no-underline ${
                              child.aktif
                                ? 'bg-[var(--aksen-lembut)] font-medium text-[var(--aksen)]'
                                : 'text-[var(--tinta-2)] hover:bg-[var(--cekung)]'
                            }`}
                          >
                            {child.label}
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

      <div className="mt-auto border-t border-[var(--garis)] pt-[0.8rem]">
        <TextSizeController />
        <Link
          href="/atur-kata-sandi"
          className="mt-[0.5rem] block min-h-[2.3rem] rounded-[var(--r-item)] px-[0.6rem] py-[0.4rem] text-[0.85rem] text-[var(--tinta-2)] no-underline hover:bg-[var(--cekung)]"
        >
          Ganti kata sandi
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            title={email ? `Keluar dari ${email}` : 'Keluar'}
            className="mt-[0.1rem] min-h-[2.3rem] w-full cursor-pointer rounded-[var(--r-item)] border border-[var(--garis-kuat)] bg-transparent px-[0.6rem] text-left text-[0.85rem] text-[var(--tinta-2)] hover:bg-[var(--cekung)]"
          >
            Keluar
          </button>
        </form>
      </div>
    </nav>
  )
}

function ItemLink({ item }: { item: ItemSidebar }) {
  return (
    <Link
      href={item.href}
      aria-current={item.aktif ? 'page' : undefined}
      className={`flex min-h-[2.75rem] items-center gap-[0.55rem] rounded-[var(--r-item)] px-[0.6rem] py-[0.4rem] text-[0.88rem] no-underline transition-colors ${
        item.aktif
          ? 'bg-[var(--aksen-lembut)] font-semibold text-[var(--aksen)]'
          : 'text-[var(--tinta-2)] hover:bg-[var(--cekung)] hover:text-[var(--tinta)]'
      }`}
    >
      <Ikon nama={item.ikon} />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  )
}

/** One inline stroke icon per menu item; decorative — the label carries the meaning. */
function Ikon({ nama }: { nama: IkonSidebar }) {
  const jalur: Record<IkonSidebar, React.ReactNode> = {
    beranda: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M10 21v-6h4v6" /></>,
    kuliah: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></>,
    ujian: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="m9 12 2 2 4-4" /></>,
    sidang: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    penilaian: <><path d="M4 20h16" /><path d="M6 16v-5M11 16V7M16 16v-8" /></>,
    master: <><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    kalender: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><circle cx="12" cy="15" r="2" /></>,
    bersama: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.5M18 15c2 .7 3 2.4 3 5" /></>,
    pengguna: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c0-3.9 3.1-6 7-6s7 2.1 7 6" /></>,
    log: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[1.15rem] w-[1.15rem] shrink-0"
    >
      {jalur[nama]}
    </svg>
  )
}
