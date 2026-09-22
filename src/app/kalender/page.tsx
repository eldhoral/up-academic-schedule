import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { fetchSchedulesForContext } from '../schedule-query'
import { KalenderClient } from './KalenderClient'
import type { AcademicYear } from '../penjadwalan-types'

export default async function KalenderPage(props: PageProps<'/kalender'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const { data: academicYears } = await supabase.from('academic_years').select('*').order('id', { ascending: false })
  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_kelas: ((searchParams.jenis as string) === 'regsus' ? 'regsus' : 'reguler') as 'reguler' | 'regsus',
    semester_ke: parseInt((searchParams.smt as string) || '1', 10) || 1,
  }

  const schedules = await fetchSchedulesForContext(context)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/kalender" />
      <KalenderClient academicYears={years} schedules={schedules} context={context} />
    </div>
  )
}
