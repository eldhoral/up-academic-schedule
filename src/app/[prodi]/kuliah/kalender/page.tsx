import { AppHeader } from '@/components/AppHeader'
import { clampSemester, parseJenisKelas } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { fetchSchedulesForContext } from '../schedule-query'
import { KalenderClient } from './KalenderClient'
import type { AcademicYear, KuliahContext } from '../penjadwalan-types'

export default async function KalenderPage(props: PageProps<'/[prodi]/kuliah/kalender'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const { data: academicYears } = await supabase.from('academic_years').select('*').order('id', { ascending: false })
  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context: KuliahContext = {
    prodi,
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_kelas: parseJenisKelas(prodi, searchParams.jenis),
    semester_ke: clampSemester(prodi, searchParams.smt),
  }

  const schedules = await fetchSchedulesForContext(context)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/kuliah/kalender" prodi={prodi} />
      <KalenderClient academicYears={years} schedules={schedules} context={context} />
    </div>
  )
}
