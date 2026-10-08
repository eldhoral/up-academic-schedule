import { hariFromTanggal } from '@/lib/hari'
import type { IcsEvent } from '@/lib/ics'
import { PRODI_CONFIG, type JenisKelas, type Prodi } from '@/lib/prodi'
import { addDays, mondayOf } from '@/lib/week'

// One lecturer's duties for the active term, and the calendar events they become. Pure: no I/O.

export type Minggu = 'setiap' | 'ganjil' | 'genap'
export type KuliahItem = { id: string; prodi: Prodi; jenis_kelas: JenisKelas; nama_mk: string; kelas: string; hari: string; jam_mulai: string; jam_selesai: string; minggu: Minggu; tempat: string }
export type UjianPeran = 'pengawas' | 'pengampu'
export type UjianItem = { id: string; prodi: Prodi; jenis_kelas: JenisKelas; jenis_ujian: 'uts' | 'uas'; nama_mk: string; kelas: string; tanggal: string; jam_mulai: string; jam_selesai: string; keterangan: string; tempat: string; peran: UjianPeran[] }
export type SidangPeran = 'pembimbing' | 'penguji'
export type SidangItem = { id: string; prodi: Prodi; jenis: 'prasidang' | 'sidang'; tanggal: string; jam_mulai: string; jam_selesai: string; nama_mahasiswa: string; peran: SidangPeran; tempat: string }
export type Term = { id: string; label: string; mulai: string | null; selesai: string | null }
export type ExamDay = { prodi: Prodi; jenis_kelas: JenisKelas; tanggal: string }

export type JadwalDosen = {
  kodeDosen: string
  nama: string // display name with titles
  term: Term | null // null: no active term
  kuliah: KuliahItem[]
  ujian: UjianItem[]
  sidang: SidangItem[]
  examDays: ExamDay[] // every dated UTS/UAS of the term, any lecturer: the weeks kuliah pauses
}

export const PROGRAM_LABEL: Record<JenisKelas, string> = { reguler: 'Reguler', regsus: 'Reguler Khusus' }
const UJIAN_PERAN_LABEL: Record<UjianPeran, string> = { pengawas: 'Pengawas', pengampu: 'Pengampu' }
// Which column each lecturer field fills (see defense-types.ts); the same wording for S1 and S2.
export const SIDANG_PERAN_LABEL: Record<'prasidang' | 'sidang', Record<SidangPeran, string>> = {
  sidang: { penguji: 'Ketua Sidang', pembimbing: 'Anggota Penguji II (Dosen Pembimbing)' },
  prasidang: { pembimbing: 'Dosen Pembimbing Pendamping', penguji: 'Dosen Pembahas' },
}

export const ujianPeranText = (peran: UjianPeran[]) => peran.map((p) => UJIAN_PERAN_LABEL[p]).join(' & ')
/** 'Prasidang' / 'Sidang' for S1, 'Seminar Proposal' / 'Sidang Tesis' for S2. */
export const sidangJudul = (s: { prodi: Prodi; jenis: 'prasidang' | 'sidang' }) => PRODI_CONFIG[s.prodi].defense[s.jenis]
const short = (p: Prodi) => PRODI_CONFIG[p].short

const WEEK_MS = 7 * 86_400_000
/** 1-based week of the term: the Senin..Minggu week containing mulai is week 1 (ganjil). */
export function termWeek(date: string, mulai: string): number {
  return Math.round((Date.parse(mondayOf(date)) - Date.parse(mondayOf(mulai))) / WEEK_MS) + 1
}

/** Every date a weekly class meets from mulai to selesai (inclusive), before exam weeks are taken out. */
export function kuliahDates(item: { hari: string; minggu: Minggu }, mulai: string, selesai: string): string[] {
  const fits = (d: string) => item.minggu === 'setiap' || (termWeek(d, mulai) % 2 === 1) === (item.minggu === 'ganjil')
  let first = mulai
  while (first <= selesai && !(hariFromTanggal(first) === item.hari && fits(first))) first = addDays(first, 1)
  const step = item.minggu === 'setiap' ? 7 : 14
  const dates: string[] = []
  for (let d = first; d <= selesai; d = addDays(d, step)) dates.push(d)
  return dates
}

export function buildEvents(j: JadwalDosen): IcsEvent[] {
  const events: IcsEvent[] = []

  const mulai = j.term?.mulai
  const selesai = j.term?.selesai
  if (mulai && selesai) {
    const examWeeks = new Set(j.examDays.map((e) => `${e.prodi}|${e.jenis_kelas}|${mondayOf(e.tanggal)}`))
    for (const k of j.kuliah) {
      const dates = kuliahDates(k, mulai, selesai)
      const skipped = dates.filter((d) => examWeeks.has(`${k.prodi}|${k.jenis_kelas}|${mondayOf(d)}`))
      if (skipped.length === dates.length) continue // never meets (or only in exam weeks)
      events.push({
        uid: `kuliah-${k.id}@krs`,
        summary: `Kuliah · ${k.nama_mk} (${k.kelas}) · ${short(k.prodi)}`,
        location: k.tempat || undefined,
        description: `${short(k.prodi)} ${PROGRAM_LABEL[k.jenis_kelas]}${k.minggu === 'setiap' ? '' : ` · minggu ${k.minggu}`}`,
        date: dates[0],
        start: k.jam_mulai,
        end: k.jam_selesai,
        repeat: { weeks: k.minggu === 'setiap' ? 1 : 2, until: selesai },
        exdates: skipped,
      })
    }
  }

  for (const u of j.ujian) {
    const allDay = u.keterangan === 'take_home'
    events.push({
      uid: `ujian-${u.id}@krs`,
      summary: `${u.jenis_ujian.toUpperCase()} ${ujianPeranText(u.peran)} · ${u.nama_mk} (${u.kelas}) · ${short(u.prodi)}`,
      location: u.tempat || undefined,
      date: u.tanggal,
      ...(allDay ? {} : { start: u.jam_mulai, end: u.jam_selesai }),
    })
  }

  for (const s of j.sidang) {
    events.push({
      uid: `sidang-${s.id}@krs`,
      summary: `${sidangJudul(s)} · ${SIDANG_PERAN_LABEL[s.jenis][s.peran]} · ${s.nama_mahasiswa} · ${short(s.prodi)}`,
      location: s.tempat || undefined,
      date: s.tanggal,
      start: s.jam_mulai,
      end: s.jam_selesai,
    })
  }

  return events
}
