'use server'

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSettings, settingInt, settingText } from '@/lib/settings'
import { prodiTag, type Prodi } from '@/lib/prodi'
import {
  dosenSks,
  findAllClashes,
  findClashes,
  freeRooms,
  orientFinding,
  type Clash,
  type ClashPairing,
  type ExistingScheduleForClash,
  type LoadRow,
  type ScheduleCandidate,
} from '@/lib/clash'
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

/** A dosen over the SKS limit for the academic year (S1 and S2 together). The client shows the name. */
export type BebanSummary = { kode_dosen: string; sks: number; maks: number; policy: ClashPolicy }

export type ClashCheckResult = {
  clashes: ClashSummary[]
  beban: BebanSummary[]
  freeRooms: { id: string; nama: string }[] // only filled when the candidate has a room clash
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
  courses: { nama_mk: string; sks: number } | { nama_mk: string; sks: number }[] | null
  rooms: { nama: string } | { nama: string }[] | null
  schedule_lecturers: { kode_dosen: string; lecturers: { nama: string; gelar_depan: string; gelar_belakang: string } | { nama: string; gelar_depan: string; gelar_belakang: string }[] | null }[]
}

type YearRow = ExistingScheduleForClash & { sks: number }

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

const CLASH_SELECT =
  'id, prodi, kode_mk, kelas, jenis_kelas, semester_ke, hari, jam_mulai, jam_selesai, minggu, room_id, courses(nama_mk, sks), rooms(nama), schedule_lecturers(kode_dosen, lecturers(nama, gelar_depan, gelar_belakang))'

function mapClashRows(data: SupabaseRow[]): YearRow[] {
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
      sks: course?.sks ?? 0,
    }
  })
}

async function getClashPolicies(prodi: Prodi): Promise<{ policies: Record<Clash['type'] | 'beban', ClashPolicy>; maksSks: number }> {
  const settings = await getSettings(prodi)
  return {
    policies: {
      dosen: settingText(settings, 'bentrok_dosen', 'blok') as ClashPolicy,
      kelas: settingText(settings, 'bentrok_kelas', 'blok') as ClashPolicy,
      ruangan: settingText(settings, 'bentrok_ruangan', 'peringatan') as ClashPolicy,
      beban: settingText(settings, 'bentrok_beban', 'peringatan') as ClashPolicy,
    },
    maksSks: settingInt(settings, 'maks_sks_dosen', 12),
  }
}

/**
 * The candidate's dosen's load for the year with the candidate counted in (and, when editing, its old
 * version left out). One query over every day, unlike the clash check's single hari.
 */
async function candidateLoad(supabase: SupabaseClient, academicYearId: string, candidate: ScheduleCandidate & { kode_mk: string }): Promise<Map<string, number>> {
  const [{ data: rows }, { data: course }] = await Promise.all([
    supabase
      .from('schedules')
      .select('id, prodi, kode_mk, kelas, jenis_kelas, semester_ke, courses(sks), schedule_lecturers!inner(kode_dosen)')
      .eq('academic_year_id', academicYearId)
      .in('schedule_lecturers.kode_dosen', candidate.dosenCodes),
    supabase.from('courses').select('sks').eq('prodi', candidate.prodi).eq('kode_mk', candidate.kode_mk).maybeSingle(),
  ])
  type Row = Omit<LoadRow, 'sks' | 'dosenCodes'> & { id: string; courses: { sks: number } | { sks: number }[] | null; schedule_lecturers: { kode_dosen: string }[] }
  const loadRows: LoadRow[] = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.id !== candidate.id)
    .map((r) => ({ ...r, sks: one(r.courses)?.sks ?? 0, dosenCodes: r.schedule_lecturers.map((sl) => sl.kode_dosen) }))
  loadRows.push({ ...candidate, sks: (course?.sks as number | undefined) ?? 0 })
  return dosenSks(loadRows)
}

export async function checkScheduleClashes(
  academicYearId: string,
  candidate: ScheduleCandidate & { kode_mk?: string }
): Promise<ClashCheckResult> {
  const empty: ClashCheckResult = { clashes: [], beban: [], freeRooms: [], blocking: false }
  if (!academicYearId || !candidate.hari || !candidate.jam_mulai || !candidate.jam_selesai) return empty

  const supabase = await createClient()
  const { kode_mk } = candidate
  const dosenCodes = candidate.dosenCodes.filter(Boolean)
  const [{ policies, maksSks }, { data, error }, load] = await Promise.all([
    getClashPolicies(candidate.prodi),
    // No prodi filter: a dosen or room taken in the other prodi is still taken.
    supabase.from('schedules').select(CLASH_SELECT).eq('academic_year_id', academicYearId).eq('hari', candidate.hari),
    kode_mk && dosenCodes.length > 0 ? candidateLoad(supabase, academicYearId, { ...candidate, kode_mk, dosenCodes }) : null,
  ])

  if (error || !data) return empty

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

  const beban: BebanSummary[] =
    policies.beban === 'abaikan' || !load
      ? []
      : dosenCodes.filter((d) => (load.get(d) ?? 0) > maksSks).map((d) => ({ kode_dosen: d, sks: load.get(d)!, maks: maksSks, policy: policies.beban }))

  let rooms: ClashCheckResult['freeRooms'] = []
  if (clashes.some((c) => c.type === 'ruangan')) {
    const { data: active } = await supabase.from('rooms').select('id, nama').eq('active', true).order('nama')
    rooms = freeRooms(active ?? [], candidate, existing)
  }

  return {
    clashes,
    beban,
    freeRooms: rooms,
    blocking: clashes.some((c) => c.policy === 'blok') || beban.some((b) => b.policy === 'blok'),
  }
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

/** Every schedule in the year, both prodi: the clash and workload checks of one request share this read. */
const fetchYearRows = cache(async (academicYearId: string): Promise<YearRow[] | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('schedules').select(CLASH_SELECT).eq('academic_year_id', academicYearId)
  return error || !data ? null : mapClashRows(data as unknown as SupabaseRow[])
})

/**
 * Standing findings-bar check for one prodi: every clash in the academic year that involves at
 * least one of its rows (an S1–S2 dosen clash shows on both prodi), with `a` as its own row and
 * the other prodi's side tagged "S1 · " / "S2 · ".
 */
export async function checkAllClashes(academicYearId: string, prodi: Prodi): Promise<ClashFinding[]> {
  if (!academicYearId) return []

  const [{ policies }, existing] = await Promise.all([getClashPolicies(prodi), fetchYearRows(academicYearId)])
  if (!existing) return []

  const raw: ClashPairing[] = findAllClashes(existing)

  return raw
    .filter((c) => policies[c.type] !== 'abaikan')
    .map((c) => orientFinding(prodi, { type: c.type, policy: policies[c.type], detail: c.detail, overlapMinutes: c.overlapMinutes, a: toFindingSide(c.a), b: toFindingSide(c.b) }))
    .filter((f): f is ClashFinding => f !== null)
    .map((f) => ({ ...f, b: { ...f.b, nama_mk: prodiTag(prodi, f.b.prodi) + f.b.nama_mk } }))
    .sort((x, y) => (x.policy === y.policy ? 0 : x.policy === 'blok' ? -1 : 1))
}

/** Dosen teaching in this prodi whose load for the year (both prodi together) is over the limit. */
export async function checkWorkload(academicYearId: string, prodi: Prodi): Promise<BebanSummary[]> {
  if (!academicYearId) return []

  const [{ policies, maksSks }, rows] = await Promise.all([getClashPolicies(prodi), fetchYearRows(academicYearId)])
  if (!rows || policies.beban === 'abaikan') return []

  const teachesHere = new Set(rows.filter((r) => r.prodi === prodi).flatMap((r) => r.dosenCodes))
  return [...dosenSks(rows)]
    .filter(([d, sks]) => teachesHere.has(d) && sks > maksSks)
    .sort(([, a], [, b]) => b - a)
    .map(([kode_dosen, sks]) => ({ kode_dosen, sks, maks: maksSks, policy: policies.beban }))
}

export type KuliahFindings = { clashes: ClashFinding[]; beban: BebanSummary[] }

/** Both standing checks for the kuliah findings bar. */
export async function checkKuliahFindings(academicYearId: string, prodi: Prodi): Promise<KuliahFindings> {
  const [clashes, beban] = await Promise.all([checkAllClashes(academicYearId, prodi), checkWorkload(academicYearId, prodi)])
  return { clashes, beban }
}
