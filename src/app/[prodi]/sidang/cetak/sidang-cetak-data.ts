import { createClient } from '@/lib/supabase/server'
import type { Prodi } from '@/lib/prodi'
import { getSettings, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { tanggalPanjang } from '@/lib/hari'
import { substituteTemplate } from '@/lib/print'
import { buildDefenseBlocks, sheetName, type DefenseBlock } from '../defense-blocks'
import { fetchDefenses } from '../defense-query'
import type { DefenseJenis } from '../defense-types'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'

export type SidangSheet = DefenseBlock & {
  name: string // Excel sheet name
  headerLines: string[]
}

/** Everything a prasidang/sidang print (preview, Excel, PDF) needs, resolved from raw query-string values. */
export async function buildSidangCetakData(prodi: Prodi, params: { ay?: string | null; jenis?: string | null; tanggal?: string | null }) {
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    getSettings(prodi),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const jenis: DefenseJenis = params.jenis === 'sidang' ? 'sidang' : 'prasidang'
  const context = {
    academic_year_id: params.ay || defaultYear,
    jenis,
    tanggal: /^\d{4}-\d{2}-\d{2}$/.test(params.tanggal ?? '') ? (params.tanggal as string) : ('all' as const), // no or odd tanggal = Semua tanggal
  }

  const all = await fetchDefenses(context.academic_year_id, jenis)
  const dates = [...new Set(all.map((d) => d.tanggal))].sort()
  const names = new Map((lecturers ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l)]))

  const label = years.find((y) => y.id === context.academic_year_id)?.label ?? ''
  const space = label.indexOf(' ')
  const template = settingText(settings, jenis === 'sidang' ? 'sidang_header_baris' : 'prasidang_header_baris', '').split('\n')

  const taken = new Set<string>()
  const sheets: SidangSheet[] = buildDefenseBlocks(
    context.tanggal === 'all' ? all : all.filter((d) => d.tanggal === context.tanggal),
    names,
  ).map((block) => {
    const vars = {
      term: space === -1 ? '' : label.slice(space + 1).toUpperCase(),
      tahun: space === -1 ? label : label.slice(0, space),
      tanggal: tanggalPanjang(block.tanggal),
      ruang: block.ruang,
      kelompok: String(block.kelompok ?? ''),
    }
    return {
      ...block,
      name: sheetName(block, jenis, taken),
      headerLines: template.map((line) => substituteTemplate(line, vars)).filter(Boolean),
    }
  })

  return {
    academicYears: years,
    context,
    academicYearLabel: label,
    dates,
    sheets,
    zoomId: settingText(settings, 'prasidang_zoom_id', ''),
    zoomPasscode: settingText(settings, 'prasidang_zoom_passcode', ''),
    namaWakilDekan: settingText(settings, 'nama_wakil_dekan', ''),
    jabatanWakilDekan: settingText(settings, 'jabatan_wakil_dekan', ''),
    namaPenandatangan: settingText(settings, 'nama_penandatangan', ''),
    jabatanPenandatangan: settingText(settings, 'jabatan_penandatangan', ''),
  }
}

export type SidangCetakData = Awaited<ReturnType<typeof buildSidangCetakData>>
