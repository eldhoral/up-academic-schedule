import { kuliahDates, type Minggu } from '@/app/jadwal-dosen/events'
import { mondayOf } from '@/lib/week'
import type { KeteranganUjian } from '@/app/[prodi]/ujian/exam-types'

// The main calendar's pieces: everything one lecturer's feed knew about, widened to the
// whole faculty (both prodi, all semesters and programs, all three schedule types).
// Pure: no I/O, heavy on the jadwal-dosen term math — kuliah meetings expand to real
// dates and pause each prodi/program's own exam weeks, exactly like the .ics feed.

export type KalTerm = { label: string; mulai: string | null; selesai: string | null } | null

/** A weekly meeting, pre-named by the page: dosen names resolved, room or Zoom computed. */
export type KalKuliah = {
  id: string
  prodi: 's1' | 's2'
  jenis_kelas: 'reguler' | 'regsus'
  semester_ke: number
  kode_mk: string
  nama_mk: string
  kelas: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  minggu: Minggu
  tempat: string
  dosen: string[]
  is_override: boolean
  override_reason: string
}

export type KalUjian = {
  id: string
  prodi: 's1' | 's2'
  jenis_kelas: 'reguler' | 'regsus'
  jenis_ujian: 'uts' | 'uas'
  semester_ke: number
  kode_mk: string
  nama_mk: string
  kelas: string
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  keterangan: KeteranganUjian // the stored value, not the label
  room_nama: string | null
  pengawas: string[] // display names, staff free-text kept as typed
  is_override: boolean
}

export type KalSidang = {
  id: string
  prodi: 's1' | 's2'
  jenis: 'prasidang' | 'sidang'
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  room_nama: string | null
  kelompok: number | null
  pembimbing: string
  penguji: string
  eksternal: string
  is_override: boolean
  override_reason: string
  link: string
}

/** One dated event on the main calendar. */
export type KalEvent = {
  jenis: 'kuliah' | 'ujian' | 'sidang'
  id: string
  tanggal: string
  jam_mulai: string
  jam_selesai: string
}

export type KalEventKuliah = KalEvent & { jenis: 'kuliah'; row: KalKuliah }
export type KalEventUjian = KalEvent & { jenis: 'ujian'; row: KalUjian }
export type KalEventSidang = KalEvent & { jenis: 'sidang'; row: KalSidang }
export type AnyKalEvent = KalEventKuliah | KalEventUjian | KalEventSidang

/** Dated UTS/UAS of the term, any lecturer: the weeks a program's kuliah pauses. */
export type ExamDay = { prodi: 's1' | 's2'; jenis_kelas: 'reguler' | 'regsus'; tanggal: string }

/** A weekly meeting over the term, one event per real date, minus its program's exam weeks. */
export function expandKuliah(rows: KalKuliah[], term: KalTerm, examDays: ExamDay[]): KalEventKuliah[] {
  const mulai = term?.mulai
  const selesai = term?.selesai
  if (!mulai || !selesai) return []
  const paused = new Set(examDays.map((e) => `${e.prodi}|${e.jenis_kelas}|${mondayOf(e.tanggal)}`))
  const out: KalEventKuliah[] = []
  for (const k of rows) {
    for (const tanggal of kuliahDates({ hari: k.hari, minggu: k.minggu }, mulai, selesai)) {
      if (paused.has(`${k.prodi}|${k.jenis_kelas}|${mondayOf(tanggal)}`)) continue
      out.push({ jenis: 'kuliah', id: `${k.id}-${tanggal}`, tanggal, jam_mulai: k.jam_mulai, jam_selesai: k.jam_selesai, row: k })
    }
  }
  return out
}

/** The whole year's dated events, ready for the grid and the week picker. */
export function allEvents(kuliahRows: KalKuliah[], ujian: KalUjian[], sidang: KalSidang[], term: KalTerm, examDays: ExamDay[]): AnyKalEvent[] {
  return [
    ...expandKuliah(kuliahRows, term, examDays),
    ...ujian.map((row) => ({ jenis: 'ujian' as const, id: `u-${row.id}`, tanggal: row.tanggal, jam_mulai: row.jam_mulai, jam_selesai: row.jam_selesai, row })),
    ...sidang.map((row) => ({ jenis: 'sidang' as const, id: `s-${row.id}`, tanggal: row.tanggal, jam_mulai: row.jam_mulai, jam_selesai: row.jam_selesai, row })),
  ]
}

/** Mondays of the weeks with events, with their event counts (the WeekNav numbers). */
export function weekCounts(events: AnyKalEvent[]): { weeks: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {}
  for (const e of events) {
    const w = mondayOf(e.tanggal)
    counts[w] = (counts[w] ?? 0) + 1
  }
  return { weeks: Object.keys(counts).sort(), counts }
}
