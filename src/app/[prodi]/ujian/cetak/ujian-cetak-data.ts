import { createClient } from '@/lib/supabase/server'
import { parseJenisKelas, type Prodi } from '@/lib/prodi'
import { getSettings, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { angkatanTa, romanSemester, substituteTemplate } from '@/lib/print'
import { fetchExamsForPrint } from '../exam-query'
import { buildExamRows, type PrintExam, type TableRow } from '../exam-rows'
import { needsRoom } from '../exam-types'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'

export type UjianSheet = {
  name: string // "Semester 3"
  semester: string // roman
  angkatan: string // "2024/2025"
  headerLines: string[]
  rows: TableRow[]
  mataKuliah: number
}

/** Everything a UTS/UAS print (preview, Excel, PDF) needs, resolved from raw query-string values. */
export async function buildUjianCetakData(prodi: Prodi, params: { ay?: string | null; ujian?: string | null; jenis?: string | null; smt?: string | null; dosen?: string | null }) {
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    getSettings(prodi),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const context = {
    prodi,
    academic_year_id: params.ay || defaultYear,
    jenis_ujian: (params.ujian === 'uas' ? 'uas' : 'uts') as 'uts' | 'uas',
    jenis_kelas: parseJenisKelas(prodi, params.jenis),
    semester_ke: parseInt(params.smt ?? '', 10) || ('all' as const), // no or non-numeric smt = Semua semester
  }

  const allExams = await fetchExamsForPrint(context)
  const names = new Map((lecturers ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l)]))

  // Per dosen: the exams a dosen teaches (pengampu, matched by display name) or proctors (pengawas).
  const involves = (e: (typeof allExams)[number], kode: string) =>
    e.pengawas.some((p) => 'kode_dosen' in p && p.kode_dosen === kode) || e.dosen.includes(names.get(kode) ?? '')
  const dosenOptions = [...names.entries()]
    .filter(([kode]) => allExams.some((e) => involves(e, kode)))
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const dosen = dosenOptions.find((d) => d.value === params.dosen) ?? null
  const exams = dosen ? allExams.filter((e) => involves(e, dosen.value)) : allExams

  const label = years.find((y) => y.id === context.academic_year_id)?.label ?? ''
  const space = label.indexOf(' ')
  const headerTemplate = settingText(settings, 'ujian_header_baris', '').split(/\r?\n/)

  const semesters =
    context.semester_ke === 'all' ? [...new Set(exams.map((e) => e.semester_ke))].sort((a, b) => a - b) : [context.semester_ke]
  const sheets: UjianSheet[] = semesters.map((semesterKe) => {
    const printExams: PrintExam[] = exams
      .filter((e) => e.semester_ke === semesterKe)
      .map((e) => ({
        kode_mk: e.kode_mk,
        nama_mk: e.courses?.nama_mk ?? e.kode_mk,
        sks: e.courses?.sks ?? null,
        kelas: e.kelas,
        tanggal: e.tanggal,
        jam_mulai: e.jam_mulai?.slice(0, 5) ?? null,
        jam_selesai: e.jam_selesai?.slice(0, 5) ?? null,
        dosen: e.dosen,
        pengawas: e.pengawas.map((p) => ('kode_dosen' in p ? (names.get(p.kode_dosen) ?? p.kode_dosen) : p.nama)),
        ruangan: needsRoom(e.keterangan_ujian) ? (e.rooms?.nama ?? '') : '',
        keterangan: e.keterangan_ujian,
        mkwu: e.inKuliah && e.dosen.length === 0, // an orphan (kuliah row gone) is not university-run
      }))

    const vars = {
      ujian: context.jenis_ujian === 'uts' ? 'TENGAH' : 'AKHIR',
      semester: romanSemester(semesterKe),
      program: context.jenis_kelas === 'regsus' ? ' REGULER KHUSUS' : '',
      angkatan_ta: angkatanTa(context.academic_year_id, semesterKe),
      term: space === -1 ? '' : label.slice(space + 1).toUpperCase(),
      tahun: space === -1 ? label : label.slice(0, space),
    }
    return {
      name: `Semester ${semesterKe}`,
      semester: vars.semester,
      angkatan: vars.angkatan_ta,
      headerLines: [...headerTemplate.map((line) => substituteTemplate(line, vars)).filter(Boolean), ...(dosen ? [`DOSEN: ${dosen.label.toUpperCase()}`] : [])],
      rows: buildExamRows(printExams),
      mataKuliah: new Set(printExams.map((e) => e.kode_mk)).size,
    }
  })

  return {
    academicYears: years,
    context,
    dosen,
    dosenOptions,
    academicYearLabel: label,
    sheets,
    namaPenandatangan: settingText(settings, 'nama_penandatangan', ''),
    jabatanPenandatangan: settingText(settings, 'jabatan_penandatangan', ''),
  }
}

export type UjianCetakData = Awaited<ReturnType<typeof buildUjianCetakData>>
