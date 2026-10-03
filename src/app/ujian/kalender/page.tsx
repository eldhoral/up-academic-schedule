import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { lecturerDisplayName } from '@/lib/import/tables'
import { fetchExamsForPrint } from '../exam-query'
import { UjianKalenderClient } from './UjianKalenderClient'
import type { AcademicYear, Lecturer } from '../../kuliah/penjadwalan-types'

export default async function UjianKalenderPage(props: PageProps<'/ujian/kalender'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*'),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_ujian: ((searchParams.ujian as string) === 'uas' ? 'uas' : 'uts') as 'uts' | 'uas',
    jenis_kelas: ((searchParams.jenis as string) === 'regsus' ? 'regsus' : 'reguler') as 'reguler' | 'regsus',
    semester_ke: parseInt((searchParams.smt as string) ?? '', 10) || ('all' as const), // no smt = Semua semester
  }
  const minggu = /^\d{4}-\d{2}-\d{2}$/.test((searchParams.minggu as string) ?? '') ? (searchParams.minggu as string) : null

  const exams = await fetchExamsForPrint(context)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ujian/kalender" />
      <UjianKalenderClient
        key={`${context.academic_year_id}-${context.jenis_ujian}-${context.jenis_kelas}-${context.semester_ke}`}
        academicYears={years}
        context={context}
        exams={exams}
        names={Object.fromEntries(((lecturers as Lecturer[]) ?? []).map((l) => [l.kode_dosen, lecturerDisplayName(l)]))}
        initialWeek={minggu}
      />
    </div>
  )
}
