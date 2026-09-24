import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { computeAngkatan, romanSemester, substituteTemplate } from '@/lib/print'
import { fetchSchedulesForContext } from '../schedule-query'
import type { AcademicYear } from '../penjadwalan-types'

/** Same data/settings a Cetak Jadwal export needs, resolved from raw query-string values. */
export async function buildCetakData(params: { ay?: string | null; jenis?: string | null; smt?: string | null }) {
  const supabase = await createClient()
  const { data: academicYears } = await supabase.from('academic_years').select('*').order('id', { ascending: false })

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''

  const context = {
    academic_year_id: params.ay || defaultYear,
    jenis_kelas: (params.jenis === 'regsus' ? 'regsus' : 'reguler') as 'reguler' | 'regsus',
    semester_ke: parseInt(params.smt || '1', 10) || 1,
  }

  const [settings, schedules] = await Promise.all([getSettings(), fetchSchedulesForContext(context)])

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

  return {
    academicYearLabel: label,
    schedules,
    headerLines,
    zoomId: settingText(settings, 'zoom_id', ''),
    zoomPasscode: settingText(settings, 'zoom_passcode', ''),
    keteranganLines,
    namaPenandatangan: settingText(settings, 'nama_penandatangan', ''),
    jabatanPenandatangan: settingText(settings, 'jabatan_penandatangan', ''),
    gambarTandaTangan: settingText(settings, 'gambar_tanda_tangan', ''),
    ukuranKertas: settingText(settings, 'ukuran_kertas', 'A4'),
    orientasi: settingText(settings, 'orientasi', 'portrait'),
  }
}

export type CetakData = Awaited<ReturnType<typeof buildCetakData>>
