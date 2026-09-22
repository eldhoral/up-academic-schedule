'use server'

import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { findAllClashes, findClashes, type Clash, type ClashPairing, type ExistingScheduleForClash, type ScheduleCandidate } from '@/lib/clash'
import { lecturerDisplayName } from '@/lib/import/tables'

export type ClashPolicy = 'blok' | 'peringatan' | 'abaikan'

export type ClashSummary = {
  type: Clash['type']
  policy: ClashPolicy
  detail: string
  kode_mk: string
  nama_mk: string
  kelas: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  overlapMinutes: number
}

export type ClashCheckResult = {
  clashes: ClashSummary[]
  blocking: boolean
}

type SupabaseRow = {
  id: string
  kode_mk: string
  kelas: string
  jenis_kelas: string
  semester_ke: number
  hari: string
  jam_mulai: string
  jam_selesai: string
  minggu: 'setiap' | 'ganjil' | 'genap'
  room_id: string | null
  courses: { nama_mk: string } | { nama_mk: string }[] | null
  rooms: { nama: string } | { nama: string }[] | null
  schedule_lecturers: { kode_dosen: string; lecturers: { nama: string; gelar_depan: string; gelar_belakang: string } | { nama: string; gelar_depan: string; gelar_belakang: string }[] | null }[]
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

const CLASH_SELECT =
  'id, kode_mk, kelas, jenis_kelas, semester_ke, hari, jam_mulai, jam_selesai, minggu, room_id, courses(nama_mk), rooms(nama), schedule_lecturers(kode_dosen, lecturers(nama, gelar_depan, gelar_belakang))'

function mapClashRows(data: SupabaseRow[]): ExistingScheduleForClash[] {
  return data.map((r) => {
    const course = one(r.courses)
    const room = one(r.rooms)
    const dosenCodes = r.schedule_lecturers.map((sl) => sl.kode_dosen)
    const dosenNames = r.schedule_lecturers.map((sl) => {
      const l = one(sl.lecturers)
      return l ? lecturerDisplayName(l) : sl.kode_dosen
    })
    return {
      id: r.id,
      kode_mk: r.kode_mk,
      nama_mk: course?.nama_mk ?? r.kode_mk,
      kelas: r.kelas,
      jenis_kelas: r.jenis_kelas,
      semester_ke: r.semester_ke,
      hari: r.hari,
      jam_mulai: r.jam_mulai,
      jam_selesai: r.jam_selesai,
      minggu: r.minggu,
      room_id: r.room_id,
      room_nama: room?.nama ?? null,
      dosenCodes,
      dosenNames,
    }
  })
}

async function getClashPolicies(): Promise<Record<Clash['type'], ClashPolicy>> {
  const settings = await getSettings()
  return {
    dosen: settingText(settings, 'bentrok_dosen', 'blok') as ClashPolicy,
    kelas: settingText(settings, 'bentrok_kelas', 'blok') as ClashPolicy,
    ruangan: settingText(settings, 'bentrok_ruangan', 'peringatan') as ClashPolicy,
  }
}

export async function checkScheduleClashes(
  academicYearId: string,
  candidate: ScheduleCandidate
): Promise<ClashCheckResult> {
  if (!academicYearId || !candidate.hari || !candidate.jam_mulai || !candidate.jam_selesai) {
    return { clashes: [], blocking: false }
  }

  const supabase = await createClient()
  const policies = await getClashPolicies()

  const { data, error } = await supabase
    .from('schedules')
    .select(CLASH_SELECT)
    .eq('academic_year_id', academicYearId)
    .eq('hari', candidate.hari)

  if (error || !data) return { clashes: [], blocking: false }

  const existing = mapClashRows(data as unknown as SupabaseRow[])
  const raw = findClashes(candidate, existing)

  const clashes: ClashSummary[] = raw
    .filter((c) => policies[c.type] !== 'abaikan')
    .map((c) => ({
      type: c.type,
      policy: policies[c.type],
      detail: c.detail,
      kode_mk: c.with.kode_mk,
      nama_mk: c.with.nama_mk,
      kelas: c.with.kelas,
      hari: c.with.hari,
      jam_mulai: c.with.jam_mulai,
      jam_selesai: c.with.jam_selesai,
      overlapMinutes: c.overlapMinutes,
    }))

  return { clashes, blocking: clashes.some((c) => c.policy === 'blok') }
}

export type ClashFindingSide = {
  kode_mk: string
  nama_mk: string
  kelas: string
  jenis_kelas: string
  semester_ke: number
  hari: string
  jam_mulai: string
  jam_selesai: string
}

export type ClashFinding = {
  type: Clash['type']
  policy: ClashPolicy
  detail: string
  overlapMinutes: number
  a: ClashFindingSide
  b: ClashFindingSide
}

function toFindingSide(row: ExistingScheduleForClash): ClashFindingSide {
  return {
    kode_mk: row.kode_mk,
    nama_mk: row.nama_mk,
    kelas: row.kelas,
    jenis_kelas: row.jenis_kelas,
    semester_ke: row.semester_ke,
    hari: row.hari,
    jam_mulai: row.jam_mulai,
    jam_selesai: row.jam_selesai,
  }
}

/**
 * Standing findings-bar check: every clash across the whole academic year,
 * not just the one row currently being edited. Scoped to the year (not the
 * semester/kelas filter) because the same lecturer or room clashing across
 * two different semesters still matters.
 */
export async function checkAllClashes(academicYearId: string): Promise<ClashFinding[]> {
  if (!academicYearId) return []

  const supabase = await createClient()
  const policies = await getClashPolicies()

  const { data, error } = await supabase.from('schedules').select(CLASH_SELECT).eq('academic_year_id', academicYearId)
  if (error || !data) return []

  const existing = mapClashRows(data as unknown as SupabaseRow[])
  const raw: ClashPairing[] = findAllClashes(existing)

  return raw
    .filter((c) => policies[c.type] !== 'abaikan')
    .map((c) => ({
      type: c.type,
      policy: policies[c.type],
      detail: c.detail,
      overlapMinutes: c.overlapMinutes,
      a: toFindingSide(c.a),
      b: toFindingSide(c.b),
    }))
    .sort((x, y) => (x.policy === y.policy ? 0 : x.policy === 'blok' ? -1 : 1))
}
