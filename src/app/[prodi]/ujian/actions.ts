'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { orientFinding } from '@/lib/clash'
import { parseProdi, prodiTag, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'
import { findExamClashes, normalizeName, type ExamClashInput, type ExamClashType } from './exam-clash'
import { loadClashWorld } from './exam-query'
import { GABUNGAN, KETERANGAN_UJIAN, keteranganFromKuliah, needsRoom, type ExamContext, type KeteranganUjian, type PengawasItem } from './exam-types'
import type { ClashPolicy } from '../kuliah/clash-actions'

export type ExamClashSummary = {
  type: ExamClashType
  policy: ClashPolicy
  detail: string
  nama_mk: string
  kelas: string
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  overlapMinutes: number
}

export type ExamClashResult = { clashes: ExamClashSummary[]; blocking: boolean; blockedRows: number[] }

export type ExamFormState =
  | { error: string }
  | { success: true; message?: string }
  | { needsOverride: true; clashes: ExamClashSummary[] }
  | null

export type ExamBlockInput = {
  context: ExamContext
  kode_mk: string
  tanggal: string // '' = not scheduled yet
  jam_mulai: string
  jam_selesai: string
  // One entry per kelas row of this mata kuliah, or one with kelas GABUNGAN.
  rows: { kelas: string; room_id: string | null; pengawas: PengawasItem[]; keterangan_ujian: KeteranganUjian }[]
  confirmOverride: boolean
  overrideReason: string
}

const CONFLICT = 'academic_year_id,jenis_ujian,jenis_kelas,semester_ke,kode_mk,kelas'

function candidatesOf(input: ExamBlockInput, nama_mk: string): ExamClashInput[] {
  return input.rows.map((r, i) => ({
    id: `cand-${i}`,
    prodi: input.context.prodi,
    kode_mk: input.kode_mk,
    nama_mk,
    jenis_ujian: input.context.jenis_ujian,
    jenis_kelas: input.context.jenis_kelas,
    semester_ke: input.context.semester_ke,
    kelas: r.kelas,
    tanggal: input.tanggal || null,
    jam_mulai: input.jam_mulai || null,
    jam_selesai: input.jam_selesai || null,
    room_id: needsRoom(r.keterangan_ujian) ? r.room_id : null,
    pengawas: r.pengawas,
    keterangan_ujian: r.keterangan_ujian,
  }))
}

/** Clashes the block being edited would cause, against every other exam in the academic year. */
export async function checkExamBlockClashes(input: ExamBlockInput): Promise<ExamClashResult> {
  const none = { clashes: [], blocking: false, blockedRows: [] }
  if (!input.tanggal || !input.jam_mulai || !input.jam_selesai) return none

  const { context: c } = input
  const world = await loadClashWorld(c.academic_year_id, c.prodi)
  const sameBlock = (e: ExamClashInput) =>
    e.prodi === c.prodi && e.kode_mk === input.kode_mk && e.jenis_ujian === c.jenis_ujian && e.jenis_kelas === c.jenis_kelas && e.semester_ke === c.semester_ke
  const others = world.exams.filter((e) => !sameBlock(e))
  const nama = world.exams.find(sameBlock)?.nama_mk ?? input.kode_mk
  const candidates = candidatesOf(input, nama)

  const clashes: ExamClashSummary[] = []
  const blockedRows = new Set<number>()
  for (const x of findExamClashes([...others, ...candidates], world.kelasMap, world.cadangan, world.names, world.roomNames)) {
    const mine = x.a.id.startsWith('cand-') ? x.a : x.b.id.startsWith('cand-') ? x.b : null
    if (!mine) continue
    const other = mine === x.a ? x.b : x.a
    if (other.id.startsWith('cand-')) continue
    const policy = world.policies[x.type]
    if (policy === 'abaikan') continue
    if (policy === 'blok') blockedRows.add(Number(mine.id.slice(5)))
    clashes.push({
      type: x.type,
      policy,
      detail: x.detail,
      nama_mk: prodiTag(c.prodi, other.prodi) + other.nama_mk,
      kelas: other.kelas,
      tanggal: other.tanggal!,
      jam_mulai: other.jam_mulai!,
      jam_selesai: other.jam_selesai!,
      overlapMinutes: x.overlapMinutes,
    })
  }
  return { clashes, blocking: clashes.some((c) => c.policy === 'blok'), blockedRows: [...blockedRows] }
}

export type ExamSide = {
  prodi: Prodi
  kode_mk: string
  nama_mk: string
  kelas: string
  jenis_ujian: string
  jenis_kelas: string
  semester_ke: number
  tanggal: string
  jam_mulai: string
  jam_selesai: string
}

export type ExamFinding = {
  type: ExamClashType
  policy: ClashPolicy
  detail: string
  overlapMinutes: number
  a: ExamSide
  b: ExamSide
}

const sideOf = (e: ExamClashInput): ExamSide => ({
  prodi: e.prodi,
  kode_mk: e.kode_mk,
  nama_mk: e.nama_mk,
  kelas: e.kelas,
  jenis_ujian: e.jenis_ujian,
  jenis_kelas: e.jenis_kelas,
  semester_ke: e.semester_ke,
  tanggal: e.tanggal!,
  jam_mulai: e.jam_mulai!,
  jam_selesai: e.jam_selesai!,
})

/** The standing findings-bar view for one prodi: clashes touching its exams, its own row first, the other prodi tagged. */
export async function checkAllExamClashes(academicYearId: string, prodi: Prodi): Promise<ExamFinding[]> {
  if (!academicYearId) return []
  const world = await loadClashWorld(academicYearId, prodi)
  return findExamClashes(world.exams, world.kelasMap, world.cadangan, world.names, world.roomNames)
    .filter((x) => world.policies[x.type] !== 'abaikan')
    .map((x) => orientFinding(prodi, { type: x.type, policy: world.policies[x.type], detail: x.detail, overlapMinutes: x.overlapMinutes, a: sideOf(x.a), b: sideOf(x.b) }))
    .filter((f): f is ExamFinding => f !== null)
    .map((f) => ({ ...f, b: { ...f.b, nama_mk: prodiTag(prodi, f.b.prodi) + f.b.nama_mk } }))
    .sort((a, b) => a.a.tanggal.localeCompare(b.a.tanggal) || a.a.jam_mulai.localeCompare(b.a.jam_mulai))
}

function validate(input: ExamBlockInput): string | null {
  const { context: c } = input
  if (!c.academic_year_id) return 'Pilih tahun akademik.'
  if (c.jenis_ujian !== 'uts' && c.jenis_ujian !== 'uas') return 'Pilih jenis ujian.'
  if (!parseProdi(c.prodi)) return 'Prodi tidak dikenali.'
  if (!PRODI_CONFIG[c.prodi].jenisKelas.includes(c.jenis_kelas)) return 'Pilih jenis kelas.'
  if (c.semester_ke < 1 || c.semester_ke > PRODI_CONFIG[c.prodi].semesters) return `Semester harus antara 1 dan ${PRODI_CONFIG[c.prodi].semesters}.`
  if (!input.kode_mk) return 'Mata kuliah wajib diisi.'
  if (input.rows.some((r) => !KETERANGAN_UJIAN.includes(r.keterangan_ujian))) return 'Pilih keterangan ujian.'
  if (input.rows.length === 0) return 'Tidak ada kelas untuk disimpan.'
  if (new Set(input.rows.map((r) => r.kelas)).size !== input.rows.length) return 'Kelas tidak boleh ganda.'
  if (input.rows.some((r) => !r.kelas)) return 'Kelas wajib diisi.'
  if (!!input.tanggal !== !!input.jam_mulai || !!input.jam_mulai !== !!input.jam_selesai) return 'Isi tanggal dan jam bersama-sama, atau kosongkan keduanya.'
  if (input.jam_mulai && input.jam_selesai <= input.jam_mulai) return 'Jam selesai harus setelah jam mulai.'
  if (input.rows.some((r) => r.pengawas.some((p) => 'nama' in p && !p.nama.trim()))) return 'Nama pengawas manual tidak boleh kosong.'
  return null
}

export async function saveExamBlockAction(input: ExamBlockInput): Promise<NonNullable<ExamFormState>> {
  const { context: c } = input
  const invalid = validate(input)
  if (invalid) return { error: invalid }
  const gate = await writableProdi(c.prodi)
  if ('error' in gate) return { error: gate.error }

  const supabase = await createClient()

  // Pengawas is a jsonb list with no foreign key, so check the dosen codes here.
  const codes = [...new Set(input.rows.flatMap((r) => r.pengawas.flatMap((p) => ('kode_dosen' in p ? [p.kode_dosen] : []))))]
  if (codes.length > 0) {
    const { data } = await supabase.from('lecturers').select('kode_dosen').in('kode_dosen', codes)
    const known = new Set((data ?? []).map((l) => l.kode_dosen as string))
    const missing = codes.filter((k) => !known.has(k))
    if (missing.length > 0) return { error: `Dosen tidak ditemukan: ${missing.join(', ')}.` }
  }

  const check = await checkExamBlockClashes(input)
  let blocked = new Set<number>()
  let overrideBy: string | null = null
  if (check.blocking) {
    if (!(input.confirmOverride && input.overrideReason.trim())) return { needsOverride: true, clashes: check.clashes }
    const world = await loadClashWorld(c.academic_year_id, c.prodi)
    if (!world.izinkanOverride) return { error: 'Ujian ini bentrok dan fitur terobos bentrok sedang dinonaktifkan di Pengaturan.' }
    blocked = new Set(check.blockedRows)
    overrideBy = (await supabase.auth.getUser()).data.user?.id ?? null
  }

  const rows = input.rows.map((r, i) => ({
    prodi: c.prodi,
    academic_year_id: c.academic_year_id,
    jenis_ujian: c.jenis_ujian,
    jenis_kelas: c.jenis_kelas,
    semester_ke: c.semester_ke,
    kode_mk: input.kode_mk,
    kelas: r.kelas,
    tanggal: input.tanggal || null,
    jam_mulai: input.jam_mulai || null,
    jam_selesai: input.jam_selesai || null,
    room_id: needsRoom(r.keterangan_ujian) ? r.room_id || null : null,
    pengawas: r.pengawas.map((p) => ('kode_dosen' in p ? { kode_dosen: p.kode_dosen } : { nama: normalizeName(p.nama) })),
    keterangan_ujian: r.keterangan_ujian,
    is_override: blocked.has(i),
    override_reason: blocked.has(i) ? input.overrideReason.trim() : '',
    override_by: blocked.has(i) ? overrideBy : null,
  }))

  // Upsert first, delete stale kelas rows second (e.g. A+B folded into GABUNGAN): if the
  // delete fails there are extra rows to see, never missing ones.
  const { error } = await supabase.from('exams').upsert(rows, { onConflict: CONFLICT })
  if (error) return { error: humanDbError(error, 'Jadwal ujian ini') }

  const keep = input.rows.map((r) => `"${r.kelas}"`).join(',')
  const { error: staleError } = await supabase
    .from('exams')
    .delete()
    .eq('prodi', c.prodi)
    .eq('academic_year_id', c.academic_year_id)
    .eq('jenis_ujian', c.jenis_ujian)
    .eq('jenis_kelas', c.jenis_kelas)
    .eq('semester_ke', c.semester_ke)
    .eq('kode_mk', input.kode_mk)
    .not('kelas', 'in', `(${keep})`)
  if (staleError) return { error: humanDbError(staleError) }

  revalidatePath('/[prodi]/ujian', 'page')
  return { success: true }
}

export async function deleteExamBlockAction(c: ExamContext, kode_mk: string): Promise<NonNullable<ExamFormState>> {
  const gate = await writableProdi(c.prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('prodi', c.prodi)
    .eq('academic_year_id', c.academic_year_id)
    .eq('jenis_ujian', c.jenis_ujian)
    .eq('jenis_kelas', c.jenis_kelas)
    .eq('semester_ke', c.semester_ke)
    .eq('kode_mk', kode_mk)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/ujian', 'page')
  return { success: true }
}

/** One unscheduled row for a kuliah class that has none yet. */
export async function addExamRowAction(c: ExamContext, kode_mk: string, kelas: string): Promise<NonNullable<ExamFormState>> {
  const gate = await writableProdi(c.prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { data: schedules } = await supabase
    .from('schedules')
    .select('room_id, zoom_id')
    .eq('prodi', c.prodi)
    .eq('academic_year_id', c.academic_year_id)
    .eq('jenis_kelas', c.jenis_kelas)
    .eq('semester_ke', c.semester_ke)
    .eq('kode_mk', kode_mk)
    .eq('kelas', kelas)
  const { error } = await supabase.from('exams').insert({
    prodi: c.prodi,
    academic_year_id: c.academic_year_id,
    jenis_ujian: c.jenis_ujian,
    jenis_kelas: c.jenis_kelas,
    semester_ke: c.semester_ke,
    kode_mk,
    kelas,
    keterangan_ujian: keteranganFromKuliah(schedules ?? []),
  })
  if (error) return { error: humanDbError(error, 'Jadwal ujian ini') }

  revalidatePath('/[prodi]/ujian', 'page')
  return { success: true }
}

/** One unscheduled row per kuliah class of the program, every semester; rows that already exist are left alone. */
export async function seedExamsFromKuliahAction(c: Omit<ExamContext, 'semester_ke'>): Promise<NonNullable<ExamFormState>> {
  const gate = await writableProdi(c.prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const [{ data: schedules, error }, { data: existing }] = await Promise.all([
    supabase.from('schedules').select('semester_ke, kode_mk, kelas, room_id, zoom_id').eq('prodi', c.prodi).eq('academic_year_id', c.academic_year_id).eq('jenis_kelas', c.jenis_kelas),
    supabase.from('exams').select('semester_ke, kode_mk, kelas').eq('prodi', c.prodi).eq('academic_year_id', c.academic_year_id).eq('jenis_ujian', c.jenis_ujian).eq('jenis_kelas', c.jenis_kelas),
  ])
  if (error) return { error: humanDbError(error) }

  const gabungan = new Set((existing ?? []).filter((e) => e.kelas === GABUNGAN).map((e) => `${e.semester_ke}|${e.kode_mk}`))
  // A kelas may meet more than once a week; it is online only if every meeting is.
  const byKelas = Map.groupBy(schedules ?? [], (s) => `${s.semester_ke}|${s.kode_mk}|${s.kelas}`)
  const rows = [...byKelas.values()]
    .map((ss) => ss[0])
    .filter((s) => !gabungan.has(`${s.semester_ke}|${s.kode_mk}`))
    .map((s) => ({
      ...c,
      semester_ke: s.semester_ke,
      kode_mk: s.kode_mk,
      kelas: s.kelas,
      keterangan_ujian: keteranganFromKuliah(byKelas.get(`${s.semester_ke}|${s.kode_mk}|${s.kelas}`)!),
    }))
  if (rows.length === 0) return { success: true, message: 'Tidak ada jadwal kuliah untuk disalin.' }

  const { data: added, error: insertError } = await supabase
    .from('exams')
    .upsert(rows, { onConflict: CONFLICT, ignoreDuplicates: true })
    .select('id')
  if (insertError) return { error: humanDbError(insertError) }

  revalidatePath('/[prodi]/ujian', 'page')
  const n = added?.length ?? 0
  return { success: true, message: `${n} ditambahkan, ${rows.length - n} sudah ada.` }
}
