import { AppShell } from '@/components/AppShell'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage } from '@/lib/roles'
import { PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { pengaturanHref, type BagianPengaturan } from '@/lib/pengaturan-bagian'
import { PengaturanClient, type SettingRow } from './PengaturanClient'

/** One Pengaturan page: this prodi's (and the shared) settings of the page's groups. */
export async function PengaturanView({ prodi, bagian }: { prodi: Prodi; bagian: BagianPengaturan }) {
  const supabase = await createClient()
  const [{ data }, user] = await Promise.all([
    bagian.groups.length
      ? supabase.from('settings').select('*').in('prodi', [prodi, 'all']).in('group', bagian.groups).order('group').order('urutan')
      : Promise.resolve({ data: [] }),
    getCurrentUser(),
  ])

  return (
    <AppShell active={pengaturanHref(bagian.slug)} prodi={prodi}>
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">
            Pengaturan {PRODI_CONFIG[prodi].label} · {bagian.slug === 'sidang' ? `Jadwal ${PRODI_CONFIG[prodi].defense.section}` : bagian.label}
          </h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            Semua aturan yang dipakai penjadwalan diatur di sini, tidak ada yang tertanam di sistem. Bagian lain ada di menu Pengaturan di atas.
          </p>
        </div>
        <PengaturanClient
          settings={(data as SettingRow[]) ?? []}
          canEdit={!!user && canManage(user.role)}
          groups={bagian.groups}
          fotoLogin={bagian.fotoLogin}
        />
      </main>
    </AppShell>
  )
}
