'use server'

import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { prodiTag, type Prodi } from '@/lib/prodi'
import { findAllClashes, orientFinding, findClashes, type Clash, type ClashPairing, type ExistingScheduleForClash, type ScheduleCandidate } from '@/lib/clash'
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
  prodi: Prodi
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
  'id, prodi, kode_mk, kelas, jenis_kelas, semester_ke, hari, jam_mulai, jam_selesai, minggu, room_id, courses(nama_mk), rooms(nama), schedule_lecturers(kode_dosen, lecturers(nama, gelar_depan, gelar_belakang))'

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
      prodi: r.prodi,
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

async function getClashPolicies(prodi: Prodi): Promise<Record<Clash['type'], ClashPolicy>> {
  const settings = await getSettings(prodi)
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
  const policies = await getClashPolicies(candidate.prodi)

  // No prodi filter: a dosen or room taken in the other prodi is still taken.
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
      nama_mk: prodiTag(candidate.prodi, c.with.prodi) + c.with.nama_mk,
      kelas: c.with.kelas,
      hari: c.with.hari,
      jam_mulai: c.with.jam_mulai,
      jam_selesai: c.with.jam_selesai,
      overlapMinutes: c.overlapMinutes,
    }))

  return { clashes, blocking: clashes.some((c) => c.policy === 'blok') }
}

export type ClashFindingSide = {
  prodi: Prodi
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
    prodi: row.prodi,
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
 * Standing findings-bar check for one prodi: every clash in the academic year that involves at
 * least one of its rows (an S1–S2 dosen clash shows on both prodi), with `a` as its own row and
 * the other prodi's side tagged "S1 · " / "S2 · ".
 */
export async function checkAllClashes(academicYearId: string, prodi: Prodi): Promise<ClashFinding[]> {
  if (!academicYearId) return []

  const supabase = await createClient()
  const policies = await getClashPolicies(prodi)

  const { data, error } = await supabase.from('schedules').select(CLASH_SELECT).eq('academic_year_id', academicYearId)
  if (error || !data) return []

  const existing = mapClashRows(data as unknown as SupabaseRow[])
  const raw: ClashPairing[] = findAllClashes(existing)

  return raw
    .filter((c) => policies[c.type] !== 'abaikan')
    .map((c) => orientFinding(prodi, { type: c.type, policy: policies[c.type], detail: c.detail, overlapMinutes: c.overlapMinutes, a: toFindingSide(c.a), b: toFindingSide(c.b) }))
    .filter((f): f is ClashFinding => f !== null)
    .map((f) => ({ ...f, b: { ...f.b, nama_mk: prodiTag(prodi, f.b.prodi) + f.b.nama_mk } }))
    .sort((x, y) => (x.policy === y.policy ? 0 : x.policy === 'blok' ? -1 : 1))
}
