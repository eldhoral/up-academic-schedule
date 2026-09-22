'use server'

import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { findClashes, type Clash, type ExistingScheduleForClash, type ScheduleCandidate } from '@/lib/clash'
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

export async function checkScheduleClashes(
  academicYearId: string,
  candidate: ScheduleCandidate
): Promise<ClashCheckResult> {
  if (!academicYearId || !candidate.hari || !candidate.jam_mulai || !candidate.jam_selesai) {
    return { clashes: [], blocking: false }
  }

  const supabase = await createClient()
  const settings = await getSettings()

  const policies: Record<Clash['type'], ClashPolicy> = {
    dosen: settingText(settings, 'bentrok_dosen', 'blok') as ClashPolicy,
    kelas: settingText(settings, 'bentrok_kelas', 'blok') as ClashPolicy,
    ruangan: settingText(settings, 'bentrok_ruangan', 'peringatan') as ClashPolicy,
  }

  const { data, error } = await supabase
    .from('schedules')
    .select(
      'id, kode_mk, kelas, jenis_kelas, semester_ke, hari, jam_mulai, jam_selesai, minggu, room_id, courses(nama_mk), rooms(nama), schedule_lecturers(kode_dosen, lecturers(nama, gelar_depan, gelar_belakang))'
    )
    .eq('academic_year_id', academicYearId)
    .eq('hari', candidate.hari)

  if (error || !data) return { clashes: [], blocking: false }

  const existing: ExistingScheduleForClash[] = (data as unknown as SupabaseRow[]).map((r) => {
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
