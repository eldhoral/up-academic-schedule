import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { lecturerDisplayName } from '@/lib/import/tables'
import { type KeteranganUjian } from '@/app/[prodi]/ujian/exam-types'
import { KalenderClient } from './KalenderClient'
import { type KalKuliah, type KalSidang, type KalTerm, type KalUjian } from './items'

// The main calendar: every schedule of one academic year — kuliah of both prodi,
// UTS/UAS and prasidang/sidang — on one dated week grid. The per-program/per-type
// kalenders stay where filtering and deep inspection live. Row → readable-field
// shaping happens here; the pure event expansion lives in items.ts (checked, and
// reused by the client for the week picker).

type RawJoined<T> = T | T[] | null
const one = <T,>(v: RawJoined<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
const hm = (t: string) => t.slice(0, 5)
const ruang = (r: { nama: string } | null) => (r ? `Ruang ${r.nama}` : '')

type RawLecturer = { kode_dosen: string; nama: string; gelar_depan: string; gelar_belakang: string }
export default async function KalenderPage(props: PageProps<'/kalender'>) {
  const rawParams = await props.searchParams
  const ay = typeof rawParams.ay === 'string' ? rawParams.ay : ''
  const supabase = await createClient()

  const [yearsQuery, scheduleQuery, examQuery, defenseQuery, lecturerQuery] = await Promise.all([
    supabase.from('academic_years').select('id, label, is_active, mulai_kuliah, selesai_kuliah').order('id', { ascending: false }),
    supabase
      .from('schedules')
      .select('id, prodi, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, minggu, zoom_id, is_override, override_reason, courses(nama_mk), rooms(nama), schedule_lecturers(kode_dosen, urutan)')
      .order('hari')
      .order('jam_mulai'),
    supabase
      .from('exams')
      .select('id, prodi, jenis_kelas, jenis_ujian, semester_ke, kode_mk, kelas, tanggal, jam_mulai, jam_selesai, keterangan_ujian, pengawas, is_override, courses(nama_mk), rooms(nama)')
      .not('tanggal', 'is', null)
      .order('tanggal')
      .order('jam_mulai'),
    supabase
      .from('defenses')
      .select('id, prodi, jenis, tanggal, jam_mulai, jam_selesai, kelompok, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode, penguji_eksternal_kode, penguji_eksternal, is_override, override_reason, link, rooms(nama)')
      .order('tanggal')
      .order('jam_mulai'),
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
  ])
  const firstError = yearsQuery.error ?? scheduleQuery.error ?? examQuery.error ?? defenseQuery.error ?? lecturerQuery.error

  type Year = { id: string; label: string; is_active: boolean; mulai_kuliah: string | null; selesai_kuliah: string | null }
  const years = (yearsQuery.data as Year[] | null) ?? []
  const chosen = years.find((y) => y.id === ay) ?? years.find((y) => y.is_active) ?? years[0]
  const names = new Map(((lecturerQuery.data as RawLecturer[]) ?? []).map((l) => [l.kode_dosen, lecturerDisplayName(l)]))

  type RawSchedule = {
    id: string; prodi: string; jenis_kelas: string; semester_ke: number; kode_mk: string; kelas: string; hari: string
    jam_mulai: string; jam_selesai: string; minggu: string; zoom_id: string; is_override: boolean; override_reason: string
    courses: { nama_mk: string } | null; rooms: { nama: string } | null; schedule_lecturers: { kode_dosen: string; urutan: number }[]
  }
  const kuliah: KalKuliah[] = chosen
    ? ((scheduleQuery.data as unknown as RawSchedule[] | null) ?? []).map((s) => ({
        id: s.id,
        prodi: s.prodi as 's1' | 's2',
        jenis_kelas: s.jenis_kelas as 'reguler' | 'regsus',
        semester_ke: s.semester_ke,
        kode_mk: s.kode_mk,
        nama_mk: one(s.courses)?.nama_mk ?? s.kode_mk,
        kelas: s.kelas,
        hari: s.hari,
        jam_mulai: hm(s.jam_mulai),
        jam_selesai: hm(s.jam_selesai),
        minggu: s.minggu as 'setiap' | 'ganjil' | 'genap',
        tempat: ruang(s.rooms) || (s.zoom_id.trim() ? `Zoom ${s.zoom_id.trim()}` : ''),
        is_override: s.is_override,
        override_reason: s.override_reason,
        dosen: (s.schedule_lecturers ?? [])
          .sort((a, b) => a.urutan - b.urutan)
          .map((sl) => names.get(sl.kode_dosen) ?? sl.kode_dosen),
      }))
    : []

  type RawExam = {
    id: string; prodi: string; jenis_kelas: string; jenis_ujian: string; semester_ke: number; kode_mk: string; kelas: string; tanggal: string
    jam_mulai: string; jam_selesai: string; keterangan_ujian: string; pengawas: unknown[]; is_override: boolean
    courses: { nama_mk: string } | null; rooms: { nama: string } | null
  }
  const ujian: KalUjian[] = chosen
    ? ((examQuery.data as unknown as RawExam[] | null) ?? []).map((e) => ({
        id: e.id,
        prodi: e.prodi as 's1' | 's2',
        jenis_kelas: e.jenis_kelas as 'reguler' | 'regsus',
        jenis_ujian: e.jenis_ujian as 'uts' | 'uas',
        semester_ke: e.semester_ke,
        kode_mk: e.kode_mk,
        nama_mk: one(e.courses)?.nama_mk ?? e.kode_mk,
        kelas: e.kelas,
        tanggal: e.tanggal,
        jam_mulai: hm(e.jam_mulai),
        jam_selesai: hm(e.jam_selesai),
        keterangan: e.keterangan_ujian as KeteranganUjian,
        room_nama: e.rooms?.nama ?? null,
        pengawas: (e.pengawas ?? [])
          .map((p) => {
            const row = p as { kode_dosen?: string; nama?: string }
            if (row && typeof row === 'object' && row.kode_dosen) return names.get(row.kode_dosen) ?? row.kode_dosen
            return row?.nama ?? ''
          })
          .filter(Boolean),
        is_override: e.is_override,
      }))
    : []

  type RawDefense = {
    id: string; prodi: string; jenis: string; tanggal: string; jam_mulai: string; jam_selesai: string; kelompok: number | null
    npm: string; nama_mahasiswa: string; judul_skripsi: string; pembimbing_kode: string | null; penguji_kode: string | null
    penguji_eksternal_kode: string | null; penguji_eksternal: string; is_override: boolean; override_reason: string
    link: string | null; rooms: { nama: string } | null
  }
  const sidang: KalSidang[] = chosen
    ? ((defenseQuery.data as unknown as RawDefense[] | null) ?? []).map((d) => ({
        id: d.id,
        prodi: d.prodi as 's1' | 's2',
        jenis: d.jenis as 'prasidang' | 'sidang',
        tanggal: d.tanggal,
        jam_mulai: hm(d.jam_mulai),
        jam_selesai: hm(d.jam_selesai),
        npm: d.npm,
        nama_mahasiswa: d.nama_mahasiswa,
        judul_skripsi: d.judul_skripsi,
        room_nama: d.rooms?.nama ?? null,
        kelompok: d.kelompok,
        pembimbing: d.pembimbing_kode ? names.get(d.pembimbing_kode) ?? d.pembimbing_kode : '',
        penguji: d.penguji_kode ? names.get(d.penguji_kode) ?? d.penguji_kode : '',
        eksternal: d.penguji_eksternal_kode ? names.get(d.penguji_eksternal_kode) ?? d.penguji_eksternal_kode : d.penguji_eksternal || '',
        is_override: d.is_override,
        override_reason: d.override_reason,
        link: d.link?.trim() ?? '',
      }))
    : []

  const term: KalTerm =
    chosen && (chosen.mulai_kuliah || chosen.selesai_kuliah) ? { label: chosen.label, mulai: chosen.mulai_kuliah, selesai: chosen.selesai_kuliah } : null

  const mingguParam = typeof rawParams.minggu === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawParams.minggu) ? rawParams.minggu : null

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/kalender" />
      <KalenderClient
        years={years.map((y) => ({ id: y.id, label: y.label }))}
        ay={chosen?.id ?? ''}
        term={term}
        kuliahRows={kuliah}
        ujian={ujian}
        sidang={sidang}
        initialWeek={mingguParam}
        loadError={firstError ? `Kalender gagal dimuat: ${humanDbError(firstError)}` : null}
      />
    </div>
  )
}
