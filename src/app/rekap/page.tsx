import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { fetchSchedulesForYear } from '../schedule-query'
import { RekapClient } from './RekapClient'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'

function pageCss(ukuranKertas: string, orientasi: string): string {
  const size = (['A4', 'Letter', 'Legal'] as const).includes(ukuranKertas as 'A4' | 'Letter' | 'Legal') ? ukuranKertas : 'A4'
  const orientation = orientasi === 'landscape' ? 'landscape' : 'portrait'
  return `
    @media print { @page { size: ${size} ${orientation}; margin: 1.5cm; } }
    .print-sheet, .print-sheet * { font-family: Arial, Helvetica, sans-serif !important; line-height: 1.25; }
    .print-sheet table { page-break-inside: auto; }
    .print-sheet tr { page-break-inside: avoid; }
    .print-sheet thead { display: table-header-group; }
  `
}

export default async function RekapPage(props: PageProps<'/rekap'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
    getSettings(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const academicYearId = (searchParams.ay as string) || defaultYear
  const selectedDosen = (searchParams.dosen as string) || 'all'

  const schedules = await fetchSchedulesForYear(academicYearId)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <div className="no-print">
        <AppHeader active="/rekap" />
      </div>
      <RekapClient
        academicYears={years}
        lecturers={(lecturers as Lecturer[]) ?? []}
        schedules={schedules}
        academicYearId={academicYearId}
        selectedDosen={selectedDosen}
        namaProdi={settingText(settings, 'nama_prodi', '')}
        pageStyle={pageCss(settingText(settings, 'ukuran_kertas', 'A4'), settingText(settings, 'orientasi', 'portrait'))}
      />
    </div>
  )
}
