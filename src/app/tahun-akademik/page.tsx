import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { TahunAkademikClient, type AcademicYearRow } from './TahunAkademikClient'

export default async function TahunAkademikPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('academic_years').select('*').order('id', { ascending: false })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/tahun-akademik" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <TahunAkademikClient years={(data as AcademicYearRow[]) ?? []} />
      </main>
    </div>
  )
}
