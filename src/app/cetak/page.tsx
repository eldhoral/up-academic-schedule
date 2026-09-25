import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { fetchSchedulesForContext } from '../schedule-query'
import { CetakClient } from './CetakClient'
import type { AcademicYear } from '../penjadwalan-types'

export default async function CetakPage(props: PageProps<'/cetak'>) {
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
      <div className="no-print">
        <AppHeader active="/cetak" />
      </div>
      <CetakClient academicYears={years} context={context} hasSchedules={schedules.length > 0} />
    </div>
  )
}
