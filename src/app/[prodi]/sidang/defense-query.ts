import { createClient } from '@/lib/supabase/server'
import type { Prodi } from '@/lib/prodi'
import { getSettings, settingText } from '@/lib/settings'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { ClashPolicy } from '../kuliah/clash-actions'
import type { DefenseClashInput, TeachingSlot } from './defense-clash'
import type { DefenseJenis, DefenseRow } from './defense-types'

// Reads for the sidang pages and the clash checks. Not a 'use server' file.

type Joined<T> = T | T[] | null
const one = <T>(v: Joined<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

type Raw = Omit<DefenseRow, 'room_nama' | 'jam_mulai' | 'jam_selesai'> & { jam_mulai: string; jam_selesai: string; rooms: Joined<{ nama: string }> }

const toRow = (r: Raw): DefenseRow => {
  const { rooms, ...rest } = r
  return { ...rest, jam_mulai: r.jam_mulai.slice(0, 5), jam_selesai: r.jam_selesai.slice(0, 5), room_nama: one(rooms)?.nama ?? null }
}

/** Every defense of one kind and prodi in an academic year, in time order. */
export async function fetchDefenses(academicYearId: string, jenis: DefenseJenis, prodi: Prodi): Promise<DefenseRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('defenses')
    .select('*, rooms(nama)')
    .eq('academic_year_id', academicYearId)
    .eq('jenis', jenis)
    .eq('prodi', prodi)
    .order('tanggal')
    .order('jam_mulai')
  return ((data ?? []) as unknown as Raw[]).map(toRow)
}

/** External examiners entered before, in any year: quick picks for the form. */
export async function fetchExternalNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('defenses').select('penguji_eksternal').neq('penguji_eksternal', '')
  return [...new Set((data ?? []).map((r) => r.penguji_eksternal as string))].sort((a, b) => a.localeCompare(b))
}

type Sched = {
  prodi: Prodi
  hari: string
  jam_mulai: string
  jam_selesai: string
  kelas: string
  courses: Joined<{ nama_mk: string }>
  schedule_lecturers: { kode_dosen: string }[]
}

/** Everything a defense clash check needs for a whole academic year (both prodi, prasidang and sidang together: a dosen in the other prodi is still taken). */
export async function loadDefenseWorld(academicYearId: string, prodi: Prodi) {
  const supabase = await createClient()
  const [{ data: defenseData }, { data: scheduleData }, { data: lecturerData }, { data: roomData }, settings] = await Promise.all([
    supabase.from('defenses').select('*, rooms(nama)').eq('academic_year_id', academicYearId),
    supabase.from('schedules').select('prodi, hari, jam_mulai, jam_selesai, kelas, courses(nama_mk), schedule_lecturers(kode_dosen)').eq('academic_year_id', academicYearId),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    supabase.from('rooms').select('id, nama'),
    getSettings(prodi),
  ])

  const defenses: DefenseClashInput[] = ((defenseData ?? []) as unknown as Raw[]).map(toRow).map((d) => ({
    id: d.id,
    prodi: d.prodi,
    jenis: d.jenis,
    tanggal: d.tanggal,
    jam_mulai: d.jam_mulai,
    jam_selesai: d.jam_selesai,
    room_id: d.room_id,
    kelompok: d.kelompok,
    npm: d.npm,
    nama_mahasiswa: d.nama_mahasiswa,
    pembimbing_kode: d.pembimbing_kode,
    penguji_kode: d.penguji_kode,
    penguji_eksternal: d.penguji_eksternal,
  }))

  const teaching: TeachingSlot[] = ((scheduleData ?? []) as unknown as Sched[]).map((s) => ({
    prodi: s.prodi,
    hari: s.hari,
    jam_mulai: s.jam_mulai.slice(0, 5),
    jam_selesai: s.jam_selesai.slice(0, 5),
    nama_mk: one(s.courses)?.nama_mk ?? '',
    kelas: s.kelas,
    dosenCodes: s.schedule_lecturers.map((l) => l.kode_dosen),
  }))

  return {
    defenses,
    teaching,
    names: new Map((lecturerData ?? []).map((l) => [l.kode_dosen as string, lecturerDisplayName(l as { nama: string; gelar_depan: string; gelar_belakang: string })])),
    roomNames: new Map((roomData ?? []).map((r) => [r.id as string, r.nama as string])),
    // Dosen and the external examiner are both "one person in two places"; room and kelompok are places.
    policies: {
      dosen: settingText(settings, 'bentrok_dosen', 'blok') as ClashPolicy,
      ruangan: settingText(settings, 'bentrok_ruangan', 'peringatan') as ClashPolicy,
    },
    izinkanOverride: settingText(settings, 'izinkan_override', 'ya') === 'ya',
  }
}
