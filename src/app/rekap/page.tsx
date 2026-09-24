import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { RekapClient } from './RekapClient'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'

export default async function RekapPage(props: PageProps<'/rekap'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const academicYearId = (searchParams.ay as string) || defaultYear
  const selectedDosen = (searchParams.dosen as string) || 'all'

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/rekap" />
      <RekapClient academicYears={years} lecturers={(lecturers as Lecturer[]) ?? []} academicYearId={academicYearId} selectedDosen={selectedDosen} />
    </div>
  )
}
