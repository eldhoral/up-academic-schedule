import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions/auth'
import { TextSizeController } from './TextSizeController'

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Penjadwalan' },
  { href: '/mata-kuliah', label: 'Mata Kuliah' },
  { href: '/dosen', label: 'Dosen' },
  { href: '/ruangan', label: 'Ruangan' },
  { href: '/sesi', label: 'Sesi' },
  { href: '/pengaturan', label: 'Pengaturan' },
  { href: '/cetak', label: 'Cetak Jadwal' },
  { href: '/rekap', label: 'Rekap Dosen' },
]

export async function AppHeader({ active }: { active: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="min-h-[3.4rem] flex items-center justify-between gap-[1rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
      <div className="flex items-center flex-wrap gap-x-[1.5rem] gap-y-[0.4rem]">
        <span className="text-[1.07rem] font-semibold tracking-[-0.01em]">Course Scheduling</span>
        <nav className="flex gap-[0.13rem] flex-wrap" aria-label="Main navigation">
          {NAV.map((item) => {
            const isActive = item.href === active
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`block px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.93rem] transition-colors ${
                  isActive
                    ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-medium'
                    : 'text-[var(--tinta-2)] hover:bg-[var(--cekung)] hover:text-[var(--tinta)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-[1.2rem]">
        <TextSizeController />
        <div className="flex items-center gap-[0.8rem] pl-[0.8rem] border-l border-[var(--garis)] text-[0.87rem]">
          <span className="text-[var(--tinta-3)] truncate max-w-[12rem]">{user?.email || 'Admin'}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)] cursor-pointer text-[0.87rem]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
