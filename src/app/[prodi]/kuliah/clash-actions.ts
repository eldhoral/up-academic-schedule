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
  overLimit,
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
  freeRooms: { id: string; nama: string; kapasitas: number }[] // only filled when the candidate has a room clash
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
 * The candidate's dosen's load for the year as saved now (`before`) and once this save lands (`after`: the
 * candidate counted in, its old version left out when editing). One query over every day, unlike the clash
 * check's single hari. Null when the read fails: better no load warning than one that under-counts.
 */
async function candidateLoad(
  supabase: SupabaseClient,
  academicYearId: string,
  candidate: ScheduleCandidate & { kode_mk: string }
): Promise<{ before: Map<string, number>; after: Map<string, number> } | null> {
  const [{ data: rows, error }, { data: course, error: courseError }] = await Promise.all([
    supabase
      .from('schedules')
      .select('id, prodi, kode_mk, kelas, jenis_kelas, semester_ke, courses(sks), schedule_lecturers!inner(kode_dosen)')
      .eq('academic_year_id', academicYearId)
      .in('schedule_lecturers.kode_dosen', candidate.dosenCodes),
    supabase.from('courses').select('sks').eq('prodi', candidate.prodi).eq('kode_mk', candidate.kode_mk).maybeSingle(),
  ])
  type Row = Omit<LoadRow, 'sks' | 'dosenCodes'> & { id: string; courses: { sks: number } | { sks: number }[] | null; schedule_lecturers: { kode_dosen: string }[] }
  if (error || courseError || !rows) return null
  const saved = (rows as unknown as Row[]).map((r) => ({ ...r, sks: one(r.courses)?.sks ?? 0, dosenCodes: r.schedule_lecturers.map((sl) => sl.kode_dosen) }))
  const next: LoadRow[] = [...saved.filter((r) => r.id !== candidate.id), { ...candidate, sks: (course?.sks as number | undefined) ?? 0 }]
  return { before: dosenSks(saved), after: dosenSks(next) }
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

  // A save only blocks on load it adds; a dosen already over the limit is still shown, as a warning.
  const beban: BebanSummary[] =
    policies.beban === 'abaikan' || !load
      ? []
      : overLimit(dosenCodes, load.before, load.after, maksSks).map((o) => ({
          kode_dosen: o.kode_dosen,
          sks: o.sks,
          maks: maksSks,
          policy: o.adds ? policies.beban : 'peringatan',
        }))

  let rooms: ClashCheckResult['freeRooms'] = []
  if (clashes.some((c) => c.type === 'ruangan')) {
    const { data: active } = await supabase.from('rooms').select('id, nama, kapasitas').eq('active', true).order('nama')
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

/** Every schedule in the year, both prodi. Cached per render: hub-status asks for S1 and S2 from one read. */
const fetchYearRows = cache(async (academicYearId: string): Promise<YearRow[] | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('schedules').select(CLASH_SELECT).eq('academic_year_id', academicYearId)
  return error || !data ? null : mapClashRows(data as unknown as SupabaseRow[])
})

type Policies = Awaited<ReturnType<typeof getClashPolicies>>

function clashFindings(rows: YearRow[], { policies }: Policies, prodi: Prodi): ClashFinding[] {
  const raw: ClashPairing[] = findAllClashes(rows)
  return raw
    .filter((c) => policies[c.type] !== 'abaikan')
    .map((c) => orientFinding(prodi, { type: c.type, policy: policies[c.type], detail: c.detail, overlapMinutes: c.overlapMinutes, a: toFindingSide(c.a), b: toFindingSide(c.b) }))
    .filter((f): f is ClashFinding => f !== null)
    .map((f) => ({ ...f, b: { ...f.b, nama_mk: prodiTag(prodi, f.b.prodi) + f.b.nama_mk } }))
    .sort((x, y) => (x.policy === y.policy ? 0 : x.policy === 'blok' ? -1 : 1))
}

/** Dosen teaching in this prodi whose load for the year (both prodi together) is over the limit. */
function workloadFindings(rows: YearRow[], { policies, maksSks }: Policies, prodi: Prodi): BebanSummary[] {
  if (policies.beban === 'abaikan') return []
  const load = dosenSks(rows)
  const teachesHere = rows.filter((r) => r.prodi === prodi).flatMap((r) => r.dosenCodes)
  return overLimit(teachesHere, load, load, maksSks)
    .sort((a, b) => b.sks - a.sks)
    .map((o) => ({ kode_dosen: o.kode_dosen, sks: o.sks, maks: maksSks, policy: policies.beban }))
}

/**
 * Standing findings-bar check for one prodi: every clash in the academic year that involves at
 * least one of its rows (an S1–S2 dosen clash shows on both prodi), with `a` as its own row and
 * the other prodi's side tagged "S1 · " / "S2 · ".
 */
export async function checkAllClashes(academicYearId: string, prodi: Prodi): Promise<ClashFinding[]> {
  if (!academicYearId) return []
  const [policies, rows] = await Promise.all([getClashPolicies(prodi), fetchYearRows(academicYearId)])
  return rows ? clashFindings(rows, policies, prodi) : []
}

export type KuliahFindings = { clashes: ClashFinding[]; beban: BebanSummary[] }

/** Both standing checks for the kuliah findings bar, from one read of the year (also outside a render, e.g. /api/clashes). */
export async function checkKuliahFindings(academicYearId: string, prodi: Prodi): Promise<KuliahFindings> {
  if (!academicYearId) return { clashes: [], beban: [] }
  const [policies, rows] = await Promise.all([getClashPolicies(prodi), fetchYearRows(academicYearId)])
  if (!rows) return { clashes: [], beban: [] }
  return { clashes: clashFindings(rows, policies, prodi), beban: workloadFindings(rows, policies, prodi) }
}
