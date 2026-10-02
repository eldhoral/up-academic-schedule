import { createClient } from '@/lib/supabase/server'
import { getSettings, settingList, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { normalizeName } from '../exam-clash'
import { fetchExamsForRekap } from '../exam-query'
import { buildPengawasRekap } from '../pengawas-rows'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'

/** Everything the pengawas rekap (preview and Excel) needs, resolved from raw query-string values. */
export async function buildRekapPengawasData(params: { ay?: string | null; ujian?: string | null }) {
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    getSettings(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context = { academic_year_id: params.ay || defaultYear, jenis_ujian: (params.ujian === 'uas' ? 'uas' : 'uts') as 'uts' | 'uas' }

  const exams = await fetchExamsForRekap(context.academic_year_id, context.jenis_ujian)
  const names = new Map((lecturers ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l)]))
  const groups = buildPengawasRekap(exams, names, new Set(settingList(settings, 'pengawas_cadangan').map(normalizeName)))

  const label = years.find((y) => y.id === context.academic_year_id)?.label ?? ''
  const space = label.indexOf(' ')
  return {
    academicYears: years,
    context,
    academicYearLabel: label,
    headerLines: [
      `REKAP PENGAWAS EVALUASI ${context.jenis_ujian === 'uts' ? 'TENGAH' : 'AKHIR'} SEMESTER`,
      `SEMESTER ${space === -1 ? '' : label.slice(space + 1).toUpperCase()} TAHUN AKADEMIK ${space === -1 ? label : label.slice(0, space)}`.replace(/\s+/g, ' '),
    ],
    groups,
    totalTugas: groups.reduce((sum, g) => sum + g.jumlah, 0),
    namaPenandatangan: settingText(settings, 'nama_penandatangan', ''),
    jabatanPenandatangan: settingText(settings, 'jabatan_penandatangan', ''),
  }
}

export type RekapPengawasData = Awaited<ReturnType<typeof buildRekapPengawasData>>
