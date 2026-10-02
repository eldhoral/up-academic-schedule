import { createClient } from '@/lib/supabase/server'
import { getSettings, settingList, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import { normalizeName, type ExamClashInput, type KelasMap } from './exam-clash'
import { GABUNGAN, type ExamContext, type ExamRow, type ExamView, type PengawasItem } from './exam-types'
import type { ClashPolicy } from '../kuliah/clash-actions'

// Reads for the ujian pages and the clash checks. Not a 'use server' file: these are
// plain server functions called from pages and from actions.ts.

type Joined<T> = T | T[] | null
const one = <T>(v: Joined<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

type RawExam = Omit<ExamRow, 'courses' | 'rooms'> & { courses: Joined<{ nama_mk: string; sks: number }>; rooms: Joined<{ nama: string }> }

const EXAM_SELECT = '*, courses(nama_mk, sks), rooms(nama)'

const toExamRow = (r: RawExam): ExamRow => ({ ...r, courses: one(r.courses), rooms: one(r.rooms) })

type Lecturer = { kode_dosen: string; nama: string; gelar_depan: string; gelar_belakang: string }
type ScheduleBit = {
  kode_mk: string
  kelas: string
  courses: Joined<{ nama_mk: string }>
  schedule_lecturers: { urutan: number; lecturers: Joined<Lecturer> }[]
}

export type AddableExam = { kode_mk: string; nama_mk: string; kelas: string }

/** Everything /ujian shows for one context: the rows, what can still be added, and each mata kuliah's kelas. */
export async function fetchExamPage(ctx: ExamContext) {
  const supabase = await createClient()
  const [{ data: examData }, { data: scheduleData }] = await Promise.all([
    supabase
      .from('exams')
      .select(EXAM_SELECT)
      .eq('academic_year_id', ctx.academic_year_id)
      .eq('jenis_ujian', ctx.jenis_ujian)
      .eq('jenis_kelas', ctx.jenis_kelas)
      .eq('semester_ke', ctx.semester_ke),
    supabase
      .from('schedules')
      .select('kode_mk, kelas, courses(nama_mk), schedule_lecturers(urutan, lecturers(kode_dosen, nama, gelar_depan, gelar_belakang))')
      .eq('academic_year_id', ctx.academic_year_id)
      .eq('jenis_kelas', ctx.jenis_kelas)
      .eq('semester_ke', ctx.semester_ke),
  ])

  const schedules = (scheduleData ?? []) as unknown as ScheduleBit[]
  const dosenOf = (s: ScheduleBit) =>
    [...s.schedule_lecturers]
      .sort((a, b) => a.urutan - b.urutan)
      .map((sl) => one(sl.lecturers))
      .filter((l): l is Lecturer => !!l)
      .map(lecturerDisplayName)

  const byKey = new Map<string, string[]>() // "kode_mk|kelas" -> dosen
  const byMk = new Map<string, string[]>() // kode_mk -> union over kelas, for GABUNGAN
  const kelasByMk: Record<string, string[]> = {}
  for (const s of schedules) {
    const dosen = dosenOf(s)
    byKey.set(`${s.kode_mk}|${s.kelas}`, dosen)
    byMk.set(s.kode_mk, [...new Set([...(byMk.get(s.kode_mk) ?? []), ...dosen])])
    kelasByMk[s.kode_mk] = [...(kelasByMk[s.kode_mk] ?? []), s.kelas].sort()
  }

  const exams: ExamView[] = ((examData ?? []) as unknown as RawExam[]).map(toExamRow).map((e) =>
    e.kelas === GABUNGAN
      ? { ...e, dosen: byMk.get(e.kode_mk) ?? [], inKuliah: byMk.has(e.kode_mk) }
      : { ...e, dosen: byKey.get(`${e.kode_mk}|${e.kelas}`) ?? [], inKuliah: byKey.has(`${e.kode_mk}|${e.kelas}`) },
  )

  const taken = new Set(exams.map((e) => `${e.kode_mk}|${e.kelas}`))
  const gabungan = new Set(exams.filter((e) => e.kelas === GABUNGAN).map((e) => e.kode_mk))
  const addable: AddableExam[] = schedules
    .filter((s) => !taken.has(`${s.kode_mk}|${s.kelas}`) && !gabungan.has(s.kode_mk))
    .map((s) => ({ kode_mk: s.kode_mk, nama_mk: one(s.courses)?.nama_mk ?? s.kode_mk, kelas: s.kelas }))
    .sort((a, b) => a.kode_mk.localeCompare(b.kode_mk) || a.kelas.localeCompare(b.kelas))

  return { exams, addable, kelasByMk }
}

/** Everything a clash check needs for a whole academic year (both programs, UTS and UAS). */
export async function loadClashWorld(academicYearId: string) {
  const supabase = await createClient()
  const [{ data: examData }, { data: scheduleData }, { data: lecturerData }, { data: roomData }, settings] = await Promise.all([
    supabase.from('exams').select(EXAM_SELECT).eq('academic_year_id', academicYearId),
    supabase.from('schedules').select('jenis_kelas, semester_ke, kelas').eq('academic_year_id', academicYearId),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    supabase.from('rooms').select('id, nama'),
    getSettings(),
  ])

  const exams: ExamClashInput[] = ((examData ?? []) as unknown as RawExam[]).map(toExamRow).map((e) => ({
    id: e.id,
    kode_mk: e.kode_mk,
    nama_mk: e.courses?.nama_mk ?? e.kode_mk,
    jenis_ujian: e.jenis_ujian,
    jenis_kelas: e.jenis_kelas,
    semester_ke: e.semester_ke,
    kelas: e.kelas,
    tanggal: e.tanggal,
    jam_mulai: e.jam_mulai?.slice(0, 5) ?? null,
    jam_selesai: e.jam_selesai?.slice(0, 5) ?? null,
    room_id: e.room_id,
    pengawas: e.pengawas as PengawasItem[],
    keterangan_ujian: e.keterangan_ujian,
  }))

  const kelasMap: KelasMap = new Map()
  const addKelas = (jenis: string, smt: number, kelas: string) => {
    if (kelas === GABUNGAN) return
    const key = `${jenis}/${smt}`
    kelasMap.set(key, [...new Set([...(kelasMap.get(key) ?? []), kelas])])
  }
  for (const s of scheduleData ?? []) addKelas(s.jenis_kelas, s.semester_ke, s.kelas)
  for (const e of exams) addKelas(e.jenis_kelas, e.semester_ke, e.kelas)

  const policies: Record<'pengawas' | 'ruangan' | 'kelas', ClashPolicy> = {
    pengawas: settingText(settings, 'bentrok_dosen', 'blok') as ClashPolicy,
    kelas: settingText(settings, 'bentrok_kelas', 'blok') as ClashPolicy,
    ruangan: settingText(settings, 'bentrok_ruangan', 'peringatan') as ClashPolicy,
  }

  return {
    exams,
    kelasMap,
    cadangan: new Set(settingList(settings, 'pengawas_cadangan').map(normalizeName)),
    names: new Map((lecturerData ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l as Lecturer)])),
    roomNames: new Map((roomData ?? []).map((r) => [r.id as string, r.nama as string])),
    policies,
    izinkanOverride: settingText(settings, 'izinkan_override', 'ya') === 'ya',
  }
}
