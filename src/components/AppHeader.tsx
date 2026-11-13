import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOutAction } from '@/app/actions/auth'
import { getCurrentUser, canManage, canWrite, isPenguji } from '@/lib/roles'
import { halamanDosen } from '@/lib/penilaian/akses'
import type { Prodi } from '@/lib/prodi'
import { TextSizeController } from './TextSizeController'
import { HeaderNav } from './HeaderNav'

export async function AppHeader({ active, prodi }: { active: string; prodi?: Prodi }) {
  const user = await getCurrentUser()
  const dosen = isPenguji(user?.role ?? null)
  // A DOSEN or EKSTERNAL sees only its grading pages. The proxy does the same before render; this is the page-level backstop.
  if (user && dosen && !halamanDosen(active, user.role)) redirect('/penilaian')

  return (
    <header className="sticky top-0 z-20 min-h-[3.4rem] flex items-center gap-[1rem] px-[1.3rem] py-[0.4rem] bg-[var(--header)] border-b border-[var(--garis-kuat)] flex-wrap">
      <div className="flex items-center gap-x-[1.5rem] gap-y-[0.4rem]">
        <Link href={dosen ? '/penilaian' : '/'} className="flex items-center gap-[0.6rem]">
          <Image
            src="/images/logo-universitas-pancasila.png"
            alt="Universitas Pancasila"
            width={64}
            height={64}
            className="h-[2.13rem] w-auto"
          />
          <span className="w-px h-[1.6rem] bg-[var(--garis-kuat)]" aria-hidden="true" />
          <Image
            src="/images/logo-fakultas-psikologi.png"
            alt="Fakultas Psikologi"
            width={64}
            height={64}
            className="h-[2.13rem] w-auto"
          />
          <span className="sr-only">Menu utama</span>
        </Link>
        {/* Minimal header for a DOSEN: no section nav, the logo is its menu. */}
        {!dosen && <HeaderNav active={active} prodi={prodi} canManage={canManage(user?.role ?? null)} canWrite={canWrite(user?.role ?? null)} />}
      </div>

      {/* ml-auto (not the parent's justify-between) so this group stays flush right even
          when it wraps onto its own line — an auto margin still applies on a lone wrapped
          flex item, unlike justify-content, which needs 2+ items on the line to do anything. */}
      <div className="flex min-w-0 items-center gap-[0.8rem] sm:gap-[1.2rem] ml-auto">
        <TextSizeController />
        <div className="flex min-w-0 items-center gap-[0.8rem] pl-[0.8rem] border-l border-[var(--garis-kuat)] text-[0.87rem]">
          {/* On a phone the email gives way so Keluar always fits; it stays in Keluar's tooltip. */}
          <span className="hidden sm:block text-[var(--tinta)] truncate max-w-[12rem]">{user?.email || 'Admin'}</span>
          {user?.role !== 'EKSTERNAL' && (
            <Link
              href="/atur-kata-sandi"
              className="shrink-0 text-[var(--biru)] hover:underline whitespace-nowrap"
            >
              Ganti kata sandi
            </Link>
          )}
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              title={user?.email ? `Keluar dari ${user.email}` : 'Keluar'}
              className="min-h-[2.4rem] px-[0.7rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)] cursor-pointer text-[0.87rem] whitespace-nowrap"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
