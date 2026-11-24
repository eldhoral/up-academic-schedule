import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { TahunAkademikClient, type AcademicYearRow } from './TahunAkademikClient'

export default async function TahunAkademikPage() {
  const supabase = await createClient()
  const [{ data }, { data: libur }] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('holidays').select('id, tanggal, label').order('tanggal'),
  ])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/tahun-akademik" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <TahunAkademikClient
          years={(data as AcademicYearRow[]) ?? []}
          libur={(libur as { id: string; tanggal: string; label: string }[]) ?? []}
          canEdit={canManage(await getCurrentRole())}
        />
      </main>
    </div>
  )
}
