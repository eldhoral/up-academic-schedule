import { GABUNGAN, KETERANGAN_LABEL, needsRoom, type KeteranganUjian, type PengawasItem } from '@/app/[prodi]/ujian/exam-types'
import { fetchHariLibur } from '@/lib/hari-libur'
import { HARI_DB } from '@/lib/hari'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { JenisKelas, Prodi } from '@/lib/prodi'
import { createAdminClient } from '@/lib/supabase/admin'
import type { JadwalDosen, KuliahItem, Minggu, SidangItem, SidangPeran, UjianItem, UjianPeran } from './events'
import { isJadwalToken } from './token'
import type { HariLibur } from '@/lib/hari-libur'

// The public jadwal dosen link: one lecturer, the active term, both prodi. Reads through the
// service role (no session on this route), so every query is narrowed to that one lecturer.

type Joined<T> = T | T[] | null
const one = <T,>(v: Joined<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
const hm = (t: string) => t.slice(0, 5)
const ruang = (r: { nama: string } | null) => (r ? `Ruang ${r.nama}` : '')
const dayIndex = (hari: string) => (HARI_DB as readonly string[]).indexOf(hari)

type RawLecturer = { kode_dosen: string; nama: string; gelar_depan: string; gelar_belakang: string }
type RawTerm = { id: string; label: string; mulai_kuliah: string | null; selesai_kuliah: string | null }
export type RawSchedule = {
  id: string; prodi: Prodi; jenis_kelas: JenisKelas; kode_mk: string; kelas: string; hari: string
  jam_mulai: string; jam_selesai: string; minggu: Minggu; zoom_id: string
  courses: Joined<{ nama_mk: string }>; rooms: Joined<{ nama: string }>
}
export type RawExam = {
  id: string; prodi: Prodi; jenis_kelas: JenisKelas; jenis_ujian: 'uts' | 'uas'; kode_mk: string; kelas: string
  tanggal: string; jam_mulai: string; jam_selesai: string; keterangan_ujian: KeteranganUjian; pengawas: PengawasItem[]
  courses: Joined<{ nama_mk: string }>; rooms: Joined<{ nama: string }>
}
export type RawDefense = {
  id: string; prodi: Prodi; jenis: 'prasidang' | 'sidang'; tanggal: string; jam_mulai: string; jam_selesai: string
  kelompok: number | null; nama_mahasiswa: string; pembimbing_kode: string | null; penguji_kode: string | null; penguji_eksternal_kode: string | null
  link: string
  rooms: Joined<{ nama: string }>
}
export type RawJadwal = { lecturer: RawLecturer; term: RawTerm | null; schedules: RawSchedule[]; exams: RawExam[]; defenses: RawDefense[]; libur?: HariLibur[]; zoom?: ZoomPerProdi }

/** The prasidang Zoom meeting of a program, from that program's settings ('prasidang_zoom_*'). */
export type ZoomRoom = { id: string; passcode: string }
export type ZoomPerProdi = Partial<Record<'s1' | 's2', ZoomRoom>>

/** Tempat on the board: prasidang sits in its own breakout room, sidang in a room. */
export function prasidangTempat(kelompok: number | null, zoom: ZoomRoom | undefined): string {
  const kelompokLabel = `Kelompok ${kelompok ?? ''}`
  if (!zoom?.id.trim()) return `${kelompokLabel} (Zoom)`
  const id = zoom.id.trim()
  return `${kelompokLabel} · Zoom ${id}${zoom.passcode.trim() ? ` · Passcode ${zoom.passcode.trim()}` : ''}`
}

const SCHEDULE_COLS = 'id, prodi, jenis_kelas, kode_mk, kelas, hari, jam_mulai, jam_selesai, minggu, zoom_id, courses(nama_mk), rooms(nama)'
const EXAM_COLS = 'id, prodi, jenis_kelas, jenis_ujian, kode_mk, kelas, tanggal, jam_mulai, jam_selesai, keterangan_ujian, pengawas, courses(nama_mk), rooms(nama)'
const DEFENSE_COLS = 'id, prodi, jenis, tanggal, jam_mulai, jam_selesai, kelompok, nama_mahasiswa, pembimbing_kode, penguji_kode, penguji_eksternal_kode, link, rooms(nama)'
// A deploy can reach prod before its migration does: without the link column the feed still
// loads (minus the Lihat Materi buttons) instead of erroring the whole schedule.
const DEFENSE_COLS_NO_LINK = 'id, prodi, jenis, tanggal, jam_mulai, jam_selesai, kelompok, nama_mahasiswa, pembimbing_kode, penguji_kode, penguji_eksternal_kode, rooms(nama)'

const byDateTime = (a: { tanggal: string; jam_mulai: string }, b: { tanggal: string; jam_mulai: string }) =>
  a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai)

/** Pure: DB rows for one lecturer into what the page and the feed show. */
export function toJadwal(raw: RawJadwal): JadwalDosen {
  const kode = raw.lecturer.kode_dosen
  const mk = (r: { prodi: string; jenis_kelas: string; kode_mk: string }) => `${r.prodi}|${r.jenis_kelas}|${r.kode_mk}`
  const taught = new Set(raw.schedules.map((s) => `${mk(s)}|${s.kelas}`))
  const taughtMk = new Set(raw.schedules.map(mk))

  const kuliah: KuliahItem[] = raw.schedules
    .map((s) => ({
      id: s.id,
      prodi: s.prodi,
      jenis_kelas: s.jenis_kelas,
      nama_mk: one(s.courses)?.nama_mk ?? s.kode_mk,
      kelas: s.kelas,
      hari: s.hari,
      jam_mulai: hm(s.jam_mulai),
      jam_selesai: hm(s.jam_selesai),
      minggu: s.minggu,
      tempat: ruang(one(s.rooms)) || (s.zoom_id.trim() ? `Zoom ${s.zoom_id.trim()}` : ''),
    }))
    .sort((a, b) => dayIndex(a.hari) - dayIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))

  const ujian: UjianItem[] = raw.exams
    .flatMap((e) => {
      const peran: UjianPeran[] = []
      if (e.pengawas.some((p) => p && typeof p === 'object' && 'kode_dosen' in p && p.kode_dosen === kode)) peran.push('pengawas')
      if (e.kelas === GABUNGAN ? taughtMk.has(mk(e)) : taught.has(`${mk(e)}|${e.kelas}`)) peran.push('pengampu')
      if (peran.length === 0) return []
      return [{
        id: e.id,
        prodi: e.prodi,
        jenis_kelas: e.jenis_kelas,
        jenis_ujian: e.jenis_ujian,
        nama_mk: one(e.courses)?.nama_mk ?? e.kode_mk,
        kelas: e.kelas,
        tanggal: e.tanggal,
        jam_mulai: hm(e.jam_mulai),
        jam_selesai: hm(e.jam_selesai),
        keterangan: e.keterangan_ujian,
        tempat: needsRoom(e.keterangan_ujian) ? ruang(one(e.rooms)) : KETERANGAN_LABEL[e.keterangan_ujian],
        peran,
      }]
    })
    .sort(byDateTime)

  const sidang: SidangItem[] = raw.defenses
    .flatMap((d) => {
      const peran: SidangPeran | null =
        d.pembimbing_kode === kode ? 'pembimbing' : d.penguji_kode === kode ? 'penguji' : d.penguji_eksternal_kode === kode ? 'eksternal' : null
      if (!peran) return []
      return [{
        id: d.id,
        prodi: d.prodi,
        jenis: d.jenis,
        tanggal: d.tanggal,
        jam_mulai: hm(d.jam_mulai),
        jam_selesai: hm(d.jam_selesai),
        nama_mahasiswa: d.nama_mahasiswa,
        peran,
        tempat: d.jenis === 'prasidang' ? prasidangTempat(d.kelompok, raw.zoom?.[d.prodi]) : ruang(one(d.rooms)),
        link: d.link?.trim() ?? '',
      }]
    })
    .sort(byDateTime)

  return {
    kodeDosen: kode,
    nama: lecturerDisplayName(raw.lecturer),
    term: raw.term && { id: raw.term.id, label: raw.term.label, mulai: raw.term.mulai_kuliah, selesai: raw.term.selesai_kuliah },
    kuliah,
    ujian,
    sidang,
    examDays: raw.exams.map((e) => ({ prodi: e.prodi, jenis_kelas: e.jenis_kelas, tanggal: e.tanggal })),
    libur: (raw.libur ?? []).map((h) => h.tanggal),
  }
}

/** null for an unknown or malformed token (the caller answers 404); throws on a DB or config error. */
export async function loadJadwalDosen(token: string): Promise<JadwalDosen | null> {
  if (!isJadwalToken(token)) return null
  const db = createAdminClient()

  const { data: lecturer, error: lecturerError } = await db
    .from('lecturers')
    .select('kode_dosen, nama, gelar_depan, gelar_belakang')
    .eq('jadwal_token', token)
    .maybeSingle()
  if (lecturerError) throw lecturerError
  if (!lecturer) return null

  const { data: term, error: termError } = await db
    .from('academic_years')
    .select('id, label, mulai_kuliah, selesai_kuliah')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (termError) throw termError
  if (!term) return toJadwal({ lecturer, term: null, schedules: [], exams: [], defenses: [] })

  const kode = lecturer.kode_dosen
  const [taught, exams, asPembimbing, asPenguji, asEksternal, libur, zoomQuery] = await Promise.all([
    db.from('schedule_lecturers').select(`schedules!inner(${SCHEDULE_COLS})`).eq('kode_dosen', kode).eq('schedules.academic_year_id', term.id),
    db.from('exams').select(EXAM_COLS).eq('academic_year_id', term.id).not('tanggal', 'is', null),
    db.from('defenses').select(DEFENSE_COLS).eq('academic_year_id', term.id).eq('pembimbing_kode', kode),
    db.from('defenses').select(DEFENSE_COLS).eq('academic_year_id', term.id).eq('penguji_kode', kode),
    db.from('defenses').select(DEFENSE_COLS).eq('academic_year_id', term.id).eq('penguji_eksternal_kode', kode),
    // Faculty-wide, a handful of rows: no term filter needed, the skip itself checks dates.
    // Holidays are an enhancement: if the table can't be read (the migration hasn't run,
    // a hiccup), the feed must still load — kuliah will simply show on those dates.
    (async () => (await fetchHariLibur(db)).libur)(),
    // The prasidang Zoom meeting (id + passcode) is per-program settings, not on the defense row.
    db.from('settings').select('prodi, key, value').in('key', ['prasidang_zoom_id', 'prasidang_zoom_passcode']),
  ])
  for (const r of [taught, exams]) if (r.error) throw r.error

  const zoom: ZoomPerProdi = {}
  for (const row of (zoomQuery.data ?? []) as { prodi: string; key: string; value: string }[]) {
    const prodi = row.prodi as 's1' | 's2'
    if (prodi !== 's1' && prodi !== 's2') continue
    ;(zoom[prodi] ??= { id: '', passcode: '' })
    if (row.key === 'prasidang_zoom_id') zoom[prodi]!.id = row.value ?? ''
    if (row.key === 'prasidang_zoom_passcode') zoom[prodi]!.passcode = row.value ?? ''
  }

  // The three role queries read the same table with link; if that one column is behind a
  // migration, refetch without it — the materi buttons just won't show on this deploy.
  const missingLink = [asPembimbing, asPenguji, asEksternal].some((r) => r.error && r.error.message.includes("'link'"))
  const onMenu = (col: string, cols = DEFENSE_COLS) => db.from('defenses').select(cols).eq('academic_year_id', term.id).eq(col, kode)
  const roles = (missingLink
    ? await Promise.all([onMenu('pembimbing_kode', DEFENSE_COLS_NO_LINK), onMenu('penguji_kode', DEFENSE_COLS_NO_LINK), onMenu('penguji_eksternal_kode', DEFENSE_COLS_NO_LINK)])
    : [asPembimbing, asPenguji, asEksternal]) as typeof asPembimbing[]
  for (const r of roles) if (r.error) throw r.error

  const schedules = ((taught.data ?? []) as unknown as { schedules: Joined<RawSchedule> }[])
    .map((r) => one(r.schedules))
    .filter((s): s is RawSchedule => !!s)

  return toJadwal({
    lecturer,
    term,
    schedules,
    exams: (exams.data ?? []) as unknown as RawExam[],
    defenses: roles.flatMap((r) => (r.data ?? []) as unknown as RawDefense[]),
    libur,
    zoom,
  })
}
