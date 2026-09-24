import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { computeAngkatan, romanSemester, substituteTemplate } from '@/lib/print'
import { fetchSchedulesForContext } from '../schedule-query'
import { CetakClient } from './CetakClient'
import type { AcademicYear } from '../penjadwalan-types'

function pageCss(ukuranKertas: string, orientasi: string): string {
  const size = (['A4', 'Letter', 'Legal'] as const).includes(ukuranKertas as 'A4' | 'Letter' | 'Legal') ? ukuranKertas : 'A4'
  const orientation = orientasi === 'landscape' ? 'landscape' : 'portrait'
  return `
    @media print {
      @page { size: ${size} ${orientation}; margin: 1.5cm 1cm; }
      .print-sheet { padding: 0 !important; }
    }
    .print-sheet, .print-sheet * { font-family: Calibri, 'Segoe UI', Arial, Helvetica, sans-serif !important; line-height: 1.25; }
    .print-sheet table { page-break-inside: auto; }
    .print-sheet tr { page-break-inside: avoid; }
    .print-sheet thead { display: table-header-group; }
  `
}

export default async function CetakPage(props: PageProps<'/cetak'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    getSettings(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context = {
    academic_year_id: (searchParams.ay as string) || defaultYear,
    jenis_kelas: ((searchParams.jenis as string) === 'regsus' ? 'regsus' : 'reguler') as 'reguler' | 'regsus',
    semester_ke: parseInt((searchParams.smt as string) || '1', 10) || 1,
  }

  const schedules = await fetchSchedulesForContext(context)

  const year = years.find((y) => y.id === context.academic_year_id)
  const angkatan = computeAngkatan(context.academic_year_id, context.semester_ke)
  const label = year?.label ?? ''
  const space = label.indexOf(' ')
  const templateVars = {
    semester: romanSemester(context.semester_ke),
    angkatan: String(angkatan),
    tahun_akademik: label,
    tahun: space === -1 ? label : label.slice(0, space),
    term: space === -1 ? '' : label.slice(space + 1).toUpperCase(),
  }
  const headerLines = settingText(settings, 'header_baris', '')
    .split('\n')
    .map((line) => substituteTemplate(line, templateVars))
    .filter(Boolean)
  const keteranganLines = settingText(settings, 'keterangan_cetak', '').split('\n').filter(Boolean)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <div className="no-print">
        <AppHeader active="/cetak" />
      </div>
      <CetakClient
        academicYears={years}
        schedules={schedules}
        context={context}
        headerLines={headerLines}
        zoomId={settingText(settings, 'zoom_id', '')}
        zoomPasscode={settingText(settings, 'zoom_passcode', '')}
        keteranganLines={keteranganLines}
        kota={settingText(settings, 'kota', '')}
        namaPenandatangan={settingText(settings, 'nama_penandatangan', '')}
        jabatanPenandatangan={settingText(settings, 'jabatan_penandatangan', '')}
        gambarTandaTangan={settingText(settings, 'gambar_tanda_tangan', '')}
        pageStyle={pageCss(settingText(settings, 'ukuran_kertas', 'A4'), settingText(settings, 'orientasi', 'portrait'))}
      />
    </div>
  )
}
