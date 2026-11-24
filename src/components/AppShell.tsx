import { getCurrentUser, isPenguji, canManage, canWrite } from '@/lib/roles'
import { canAccessProdi, type Prodi } from '@/lib/prodi'
import { sectionOf } from './nav-sections'
import { HeaderNav } from './HeaderNav'
import { AppHeader } from './AppHeader'
import { Sidebar } from './Sidebar'
import { SidebarToggle } from './SidebarToggle'

export async function AppShell({
  active,
  prodi,
  children,
}: {
  active: string
  prodi?: Prodi
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const dosen = isPenguji(user?.role ?? null)

  if (dosen) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader active={active} prodi={prodi} />
        {children}
      </div>
    )
  }

  const role = user?.role ?? null
  const prodiAccess = user?.prodiAccess ?? 's1'
  const manage = canManage(role)
  const akunEksternal = !!user && canWrite(user.role) && canAccessProdi(prodiAccess, 's1')
  const section = sectionOf(active, prodi, manage, akunEksternal)

  return (
    <div className="min-h-screen flex bg-[var(--kertas)]">
      <Sidebar
        active={active}
        prodi={prodi}
        user={user}
        className="hidden md:flex w-[15rem] shrink-0 sticky top-0 h-screen"
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {section ? (
          <div className="no-print sticky top-0 z-20 min-h-[3.4rem] flex items-center gap-[0.8rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
            <SidebarToggle>
              <Sidebar active={active} prodi={prodi} user={user} phone className="w-full h-full" />
            </SidebarToggle>
            <HeaderNav active={active} prodi={prodi} canManage={manage} akunEksternal={akunEksternal} />
          </div>
        ) : (
          <div className="no-print sticky top-0 z-20 min-h-[3.4rem] flex md:hidden items-center gap-[0.8rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)]">
            <SidebarToggle>
              <Sidebar active={active} prodi={prodi} user={user} phone className="w-full h-full" />
            </SidebarToggle>
            <span className="font-semibold text-[0.93rem] text-[var(--tinta)]">
              {active === '/' ? 'Beranda' : ''}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}
