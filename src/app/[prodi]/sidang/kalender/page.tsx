import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { lecturerDisplayName } from '@/lib/import/tables'
import { fetchDefenses } from '../defense-query'
import { SidangKalenderClient } from './SidangKalenderClient'
import type { AcademicYear, Lecturer } from '../../kuliah/penjadwalan-types'

export default async function SidangKalenderPage(props: PageProps<'/[prodi]/sidang/kalender'>) {
  const prodi = await prodiParam(props.params)
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*'),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const jenisParam = searchParams.jenis as string
  const context = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis: (jenisParam === 'prasidang' || jenisParam === 'sidang' ? jenisParam : 'all') as 'prasidang' | 'sidang' | 'all',
  }
  const minggu = /^\d{4}-\d{2}-\d{2}$/.test((searchParams.minggu as string) ?? '') ? (searchParams.minggu as string) : null

  // Both kinds on one calendar by default: a dosen sits on prasidang and sidang alike.
  const defenses = (
    await Promise.all((context.jenis === 'all' ? (['prasidang', 'sidang'] as const) : [context.jenis]).map((j) => fetchDefenses(context.academic_year_id, j)))
  ).flat()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/kalender" prodi={prodi} />
      <SidangKalenderClient
        key={`${context.academic_year_id}-${context.jenis}`}
        academicYears={years}
        context={context}
        defenses={defenses}
        names={Object.fromEntries(((lecturers as Lecturer[]) ?? []).map((l) => [l.kode_dosen, lecturerDisplayName(l)]))}
        initialWeek={minggu}
      />
    </div>
  )
}
