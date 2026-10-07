import { createClient } from '@/lib/supabase/server'
import type { Prodi } from '@/lib/prodi'
import { getSettings, settingList, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { normalizeName } from '../exam-clash'
import { fetchExamsForRekap } from '../exam-query'
import { buildPengawasRekap } from '../pengawas-rows'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'

/** Everything the pengawas rekap (preview and Excel) needs, resolved from raw query-string values. */
export async function buildRekapPengawasData(prodi: Prodi, params: { ay?: string | null; ujian?: string | null; pengawas?: string | null }) {
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    getSettings(prodi),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context = { academic_year_id: params.ay || defaultYear, jenis_ujian: (params.ujian === 'uas' ? 'uas' : 'uts') as 'uts' | 'uas' }

  const exams = await fetchExamsForRekap(context.academic_year_id, context.jenis_ujian)
  const names = new Map((lecturers ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l)]))
  const all = buildPengawasRekap(exams, names, new Set(settingList(settings, 'pengawas_cadangan').map(normalizeName)))
  // Per pengawas: one group's key (e.g. 'dosen:D01') narrows the rekap to that person. A key
  // not in this year/ujian (left over after switching) falls back to everyone.
  const picked = all.filter((g) => g.key === params.pengawas)
  const groups = picked.length > 0 ? picked : all

  const label = years.find((y) => y.id === context.academic_year_id)?.label ?? ''
  const space = label.indexOf(' ')
  return {
    academicYears: years,
    context,
    pengawas: picked.length > 0 ? params.pengawas! : '',
    pengawasOptions: all.map((g) => ({ value: g.key, label: g.nama })),
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
