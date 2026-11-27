import { hariFromTanggal } from '@/lib/hari'
import type { IcsEvent } from '@/lib/ics'
import { bisaDinilaiSidang, isPrasidangS1, penilaianSidangPath } from '@/lib/penilaian/akses'
import { beritaAcaraPath } from '@/lib/penilaian/prasidang'
import { PRODI_CONFIG, type JenisKelas, type Prodi } from '@/lib/prodi'
import { addDays, mondayOf } from '@/lib/week'
import { ujianLabel } from '@/lib/ujian'

// One lecturer's duties for the active term, and the calendar events they become. Pure: no I/O.

export type Minggu = 'setiap' | 'ganjil' | 'genap'
export type KuliahItem = { id: string; prodi: Prodi; jenis_kelas: JenisKelas; nama_mk: string; kelas: string; hari: string; jam_mulai: string; jam_selesai: string; minggu: Minggu; tempat: string }
export type UjianPeran = 'pengawas' | 'pengampu'
export type UjianItem = { id: string; prodi: Prodi; jenis_kelas: JenisKelas; jenis_ujian: 'uts' | 'uas'; nama_mk: string; kelas: string; tanggal: string; jam_mulai: string; jam_selesai: string; keterangan: string; tempat: string; peran: UjianPeran[] }
export type SidangPeran = 'pembimbing' | 'penguji' | 'eksternal'
export type SidangItem = { id: string; prodi: Prodi; jenis: 'prasidang' | 'sidang'; tanggal: string; jam_mulai: string; jam_selesai: string; nama_mahasiswa: string; peran: SidangPeran; tempat: string; link: string }
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
  libur: string[] // faculty-wide holiday dates: kuliah meetings on them are dropped
}

export const PROGRAM_LABEL: Record<JenisKelas, string> = { reguler: 'Reguler', regsus: 'Reguler Khusus' }
const UJIAN_PERAN_LABEL: Record<UjianPeran, string> = { pengawas: 'Pengawas', pengampu: 'Pengampu' }
// Which column each lecturer field fills (see defense-types.ts); the same wording for S1 and S2.
// A prasidang has no Penguji I (the DB allows it on a sidang only); its label is there for the type.
export const SIDANG_PERAN_LABEL: Record<'prasidang' | 'sidang', Record<SidangPeran, string>> = {
  sidang: { penguji: 'Ketua Sidang', eksternal: 'Anggota Penguji I (Penguji Eksternal)', pembimbing: 'Anggota Penguji II (Dosen Pembimbing)' },
  prasidang: { pembimbing: 'Dosen Pembimbing Pendamping', penguji: 'Dosen Pembahas', eksternal: 'Anggota Penguji I' },
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

/** The origin the visitor used. Behind a proxy the x-forwarded-* headers name it (first hop when a list), else Host. */
export function publicOrigin(h: Headers): string {
  const first = (name: string) => h.get(name)?.split(',')[0].trim() || null
  return `${first('x-forwarded-proto') ?? 'https'}://${first('x-forwarded-host') ?? h.get('host') ?? ''}`
}

/**
 * Where this lecturer fills the item online, or null. One source for the page and the calendar.
 * S1 prasidang: the berita acara, for the Pembimbing Pendamping (pembimbing) only; Pembahas and eksternal do not.
 * S1 sidang: grading, for all three examiners (Ketua, Anggota I = eksternal, Anggota II = pembimbing).
 */
export const linkNilai = (s: Pick<SidangItem, 'id' | 'prodi' | 'jenis' | 'peran'>): string | null =>
  bisaDinilaiSidang(s) ? penilaianSidangPath(s.id) : isPrasidangS1(s) && s.peran === 'pembimbing' ? beritaAcaraPath(s.id) : null

/** Sidang shows this many days ahead on the public page, so examiners can review the materi first (faculty request, 2026-11-23). */
export const SIDANG_HARI_MAJU = 7

/**
 * The public page lists today's prasidang, and sidang from today to SIDANG_HARI_MAJU days ahead (the calendar feed
 * keeps every date), in two lists by date and jam. Prasidang holds S2's seminar proposal too; sidang holds sidang tesis.
 */
export function sidangHariIni(items: SidangItem[], today: string): { prasidang: SidangItem[]; sidang: SidangItem[] } {
  const akhir = addDays(today, SIDANG_HARI_MAJU)
  const urut = [...items].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai))
  return {
    prasidang: urut.filter((s) => s.jenis === 'prasidang' && s.tanggal === today),
    sidang: urut.filter((s) => s.jenis === 'sidang' && s.tanggal >= today && s.tanggal <= akhir),
  }
}

/** The calendar line label for linkNilai. */
const labelLink = (s: Pick<SidangItem, 'jenis'>): string => (s.jenis === 'prasidang' ? 'Berita acara' : 'Penilaian')

/** Exam weeks pause one program's classes; holidays pause everyone, faculty-wide. */
function tanggalLibur(j: JadwalDosen): (k: KuliahItem, date: string) => boolean {
  const examWeeks = new Set(j.examDays.map((e) => `${e.prodi}|${e.jenis_kelas}|${mondayOf(e.tanggal)}`))
  const liburSet = new Set(j.libur)
  return (k, d) => liburSet.has(d) || examWeeks.has(`${k.prodi}|${k.jenis_kelas}|${mondayOf(d)}`)
}

export type AgendaItem =
  | { jenis: 'kuliah'; jam_mulai: string; item: KuliahItem }
  | { jenis: 'ujian'; jam_mulai: string; item: UjianItem }
  | { jenis: 'sidang'; jam_mulai: string; item: SidangItem }

/** Everything on `today` for the page's "Hari ini" card, by start time. Classes follow the calendar feed's rules. */
export function agendaHariIni(j: JadwalDosen, today: string): AgendaItem[] {
  const mulai = j.term?.mulai
  const selesai = j.term?.selesai
  const libur = tanggalLibur(j)
  const kuliah: AgendaItem[] =
    mulai && selesai && today >= mulai && today <= selesai
      ? j.kuliah
          .filter((k) => k.hari === hariFromTanggal(today) && kuliahDates(k, mulai, selesai).includes(today) && !libur(k, today))
          .map((k) => ({ jenis: 'kuliah', jam_mulai: k.jam_mulai, item: k }))
      : []
  const ujian: AgendaItem[] = j.ujian.filter((u) => u.tanggal === today).map((u) => ({ jenis: 'ujian', jam_mulai: u.jam_mulai, item: u }))
  const sidang: AgendaItem[] = j.sidang.filter((s) => s.tanggal === today).map((s) => ({ jenis: 'sidang', jam_mulai: s.jam_mulai, item: s }))
  return [...kuliah, ...ujian, ...sidang].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
}

/** origin (e.g. https://host) makes the grading link absolute for the calendar; the page passes none. */
export function buildEvents(j: JadwalDosen, origin?: string): IcsEvent[] {
  const events: IcsEvent[] = []

  const mulai = j.term?.mulai
  const selesai = j.term?.selesai
  if (mulai && selesai) {
    const libur = tanggalLibur(j)
    for (const k of j.kuliah) {
      const dates = kuliahDates(k, mulai, selesai)
      const skipped = dates.filter((d) => libur(k, d))
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
      summary: `${ujianLabel(u.jenis_ujian)} ${ujianPeranText(u.peran)} · ${u.nama_mk} (${u.kelas}) · ${short(u.prodi)}`,
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
      // The material and grading links ride in the description, so the subscribed calendar offers them too.
      description: [s.link.trim(), origin && linkNilai(s) ? `${labelLink(s)}: ${origin}${linkNilai(s)}` : ''].filter(Boolean).join('\n') || undefined,
      date: s.tanggal,
      start: s.jam_mulai,
      end: s.jam_selesai,
    })
  }

  return events
}
