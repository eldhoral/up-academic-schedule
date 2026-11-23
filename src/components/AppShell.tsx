import { redirect } from 'next/navigation'
import { canAccessProdi, type Prodi } from '@/lib/prodi'
import { halamanDosen } from '@/lib/penilaian/akses'
import { canManage, canWrite, getCurrentUser, isPenguji } from '@/lib/roles'
import { AppHeader } from './AppHeader'
import { HeaderNav } from './HeaderNav'
import { sectionOf } from './nav-sections'
import { Sidebar } from './Sidebar'
import { SidebarToggle } from './SidebarToggle'

/**
 * The frame around every page. Staff get the left sidebar plus the section tab
 * bar; DOSEN/EKSTERNAL keep the old minimal top bar.
 */
export async function AppShell({ active, prodi, children }: { active: string; prodi?: Prodi; children: React.ReactNode }) {
  const user = await getCurrentUser()
  const dosen = isPenguji(user?.role ?? null)
  // Page-level backstop: the proxy does the same before render.
  if (user && dosen && !halamanDosen(active, user.role)) redirect('/penilaian')

  if (!user || dosen) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader active={active} prodi={prodi} />
        {children}
      </div>
    )
  }

  const bisaKelola = canManage(user.role)
  const akunEksternal = canWrite(user.role) && canAccessProdi(user.prodiAccess, 's1')
  const adaBagian = !!sectionOf(active, prodi, bisaKelola, akunEksternal)
  const sidebar = <Sidebar active={active} prodi={prodi} role={user.role} prodiAccess={user.prodiAccess} email={user.email} />

  return (
    <div className="min-h-screen flex bg-[var(--kertas)]">
      <aside className="no-print sticky top-0 hidden h-screen w-[15rem] shrink-0 md:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`no-print sticky top-0 z-20 flex min-h-[3.4rem] items-center gap-[0.5rem] border-b border-[var(--garis)] bg-[var(--lembar)] px-[0.9rem] py-[0.3rem] ${adaBagian ? '' : 'md:hidden'}`}>
          <SidebarToggle>{sidebar}</SidebarToggle>
          {adaBagian ? (
            <HeaderNav active={active} prodi={prodi} canManage={bisaKelola} akunEksternal={akunEksternal} />
          ) : (
            <span className="text-[0.95rem] font-semibold text-[var(--tinta)]">Beranda</span>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
