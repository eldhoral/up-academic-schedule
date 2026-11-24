import type { SupabaseClient } from '@supabase/supabase-js'
import { HARI_DB, hariLabel } from '@/lib/hari'
import { PERAN_SIDANG, todayJakarta, type PeranSidang } from '@/lib/penilaian/akses'
import { nilaiSidang, round2 } from '@/lib/penilaian/nilai'
import { type Hasil, type PeranPrasidang } from '@/lib/penilaian/prasidang'
import { buildRekapPrasidang, type RekapPrasidang } from '@/lib/penilaian/rekap-prasidang'
import type { Prodi } from '@/lib/prodi'
import type { AuditRow } from '@/lib/audit-log'
import { addDays } from '@/lib/week'
import { placeLabel } from './[prodi]/sidang/defense-types'

export type HariKelas = { hari: string; label: string; jumlah: Partial<Record<Prodi, number>> }

/** Senin–Sabtu always; Minggu only when a class actually lands there. */
export function kelasPerHari(rows: { prodi: Prodi; hari: string }[], prodiList: Prodi[]): HariKelas[] {
  const hari = HARI_DB.filter((h) => h !== 'MINGGU' || rows.some((r) => r.hari === h))
  return hari.map((h) => {
    const jumlah: Partial<Record<Prodi, number>> = {}
    for (const p of prodiList) jumlah[p] = 0
    for (const r of rows) if (r.hari === h && Object.hasOwn(jumlah, r.prodi)) jumlah[r.prodi] = (jumlah[r.prodi] ?? 0) + 1
    return { hari: h, label: hariLabel(h), jumlah }
  })
}

export type TitikNilai = { id: string; label: string; rata: number; n: number }

/** One semester = one academic year id; only locked sidang with all three grades count. */
export function nilaiPerSemester(rows: { academicYearId: string; label: string; nilai: (number | null)[] }[], jumlah = 4): TitikNilai[] {
  const byYear = new Map<string, { label: string; angka: number[] }>()
  for (const r of rows) {
    const n = nilaiSidang(r.nilai)
    if (n === null) continue
    const entry = byYear.get(r.academicYearId) ?? { label: r.label, angka: [] }
    entry.angka.push(n)
    byYear.set(r.academicYearId, entry)
  }
  return [...byYear.entries()]
    .map(([id, { label, angka }]) => ({ id, label, rata: round2(angka.reduce((a, b) => a + b, 0) / angka.length), n: angka.length }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(-jumlah)
}

export type HitunganPrasidang = { layak: number; layak_revisi: number; tidak_layak: number; belum_lengkap: number }

/** A Super Admin decision wins over the berita acara; no berita acara counts as belum lengkap. */
export function hitungHasilPrasidang(rows: Pick<RekapPrasidang, 'status' | 'keputusan'>[]): HitunganPrasidang {
  const hitung: HitunganPrasidang = { layak: 0, layak_revisi: 0, tidak_layak: 0, belum_lengkap: 0 }
  for (const r of rows) {
    const hasil = r.keputusan?.hasil ?? (r.status === 'tidak_ada' ? 'belum_lengkap' : r.status)
    hitung[hasil]++
  }
  return hitung
}

export type SidangDatang = { id: string; prodi: Prodi; jenis: 'prasidang' | 'sidang'; tanggal: string; jam: string; nama: string; tempat: string }

/** Today through today+7 (inclusive), by date then time. */
export function sidangMendatang(
  rows: { id: string; prodi: Prodi; jenis: 'prasidang' | 'sidang'; tanggal: string; jam_mulai: string; jam_selesai: string; nama_mahasiswa: string; room_nama: string | null; kelompok: number | null }[],
  today: string,
  hari = 7,
): SidangDatang[] {
  const akhir = addDays(today, hari)
  return rows
    .filter((r) => r.tanggal >= today && r.tanggal <= akhir)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai) || a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      prodi: r.prodi,
      jenis: r.jenis,
      tanggal: r.tanggal,
      jam: `${r.jam_mulai.slice(0, 5)}–${r.jam_selesai.slice(0, 5)}`,
      nama: r.nama_mahasiswa,
      tempat: placeLabel({ room_nama: r.room_nama, kelompok: r.kelompok }),
    }))
}

export type Beranda = {
  kelas: HariKelas[]
  nilai: TitikNilai[] | null
  prasidang: HitunganPrasidang | null
  mendatang: SidangDatang[]
  aktivitas: AuditRow[]
}

/** PostgREST returns a to-one join as an object or a one-element array, depending on the client version. */
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

/**
 * One session client, staff RLS. The page's error boundary shows a failed query.
 * `yearId === null` uses an impossible id, so every year-bound read comes back empty.
 */
export async function loadBeranda(supabase: SupabaseClient, yearId: string | null, prodiList: Prodi[]): Promise<Beranda> {
  const ay = yearId ?? ''
  const s1 = prodiList.includes('s1')
  // The trend needs an active year to have a frame of reference, but spans every semester.
  const s1Trend = s1 && !!yearId
  const today = todayJakarta()
  const kosong = Promise.resolve({ data: [] as Record<string, unknown>[], error: null })

  const [sch, hasil, years, prasidang, isian, keputusan, sidNpm, defenses, log] = await Promise.all([
    supabase.from('schedules').select('prodi, hari').eq('academic_year_id', ay).in('prodi', prodiList),
    s1Trend
      ? supabase.from('hasil_sidang').select('defense_id, defenses!inner(academic_year_id, prodi)').eq('defenses.prodi', 's1').not('locked_at', 'is', null)
      : kosong,
    s1Trend ? supabase.from('academic_years').select('id, label') : kosong,
    s1
      ? supabase.from('defenses').select('id, npm, tanggal, created_at, nama_mahasiswa, judul_skripsi').eq('prodi', 's1').eq('jenis', 'prasidang').eq('academic_year_id', ay)
      : kosong,
    s1
      ? supabase.from('berita_acara_prasidang').select('defense_id, peran, hasil, email_status, email_detail, submitted_at, defenses!inner(academic_year_id)').eq('defenses.academic_year_id', ay)
      : kosong,
    s1 ? supabase.from('keputusan_prasidang').select('npm, prasidang_id, hasil, alasan') : kosong,
    s1 ? supabase.from('defenses').select('npm').eq('prodi', 's1').eq('jenis', 'sidang') : kosong,
    supabase.from('defenses')
      .select('id, prodi, jenis, tanggal, jam_mulai, jam_selesai, nama_mahasiswa, kelompok, rooms(nama)')
      .gte('tanggal', today).lte('tanggal', addDays(today, 7)).in('prodi', prodiList),
    supabase.from('audit_log').select('*').not('action', 'in', '(LOGIN,LOGOUT)').order('at', { ascending: false }).limit(5),
  ])
  // The grades are only needed for the locked sidang the first query found, across all semesters.
  const ids = (hasil.data ?? []).map((h) => String(h.defense_id))
  const nilaiMentah = s1Trend && ids.length
    ? await supabase.from('nilai_sidang').select('defense_id, peran, nilai').in('defense_id', ids)
    : { data: [] as Record<string, unknown>[], error: null }
  const err = sch.error ?? hasil.error ?? nilaiMentah.error ?? years.error ?? prasidang.error ?? isian.error ?? keputusan.error ?? sidNpm.error ?? defenses.error ?? log.error
  if (err) throw new Error(`Gagal memuat data beranda: ${err.message}`)

  const kelas = kelasPerHari((sch.data ?? []).map((r) => ({ prodi: r.prodi as Prodi, hari: String(r.hari) })), prodiList)

  // Locked S1 sidang of every semester, one three-grade array per defense.
  const labelByYear = new Map((years.data ?? []).map((y) => [String(y.id), String(y.label)]))
  const yearByDefense = new Map((hasil.data ?? []).map((h) => {
    const join = one<{ academic_year_id: string }>(h.defenses as { academic_year_id: string } | { academic_year_id: string }[] | null)
    return [String(h.defense_id), join?.academic_year_id ?? ''] as const
  }))
  const nilaiByDefense = new Map<string, (number | null)[]>()
  for (const n of nilaiMentah.data ?? []) {
    const id = String(n.defense_id)
    const tiga = nilaiByDefense.get(id) ?? [null, null, null]
    const idx = PERAN_SIDANG.indexOf(n.peran as PeranSidang)
    if (idx >= 0) tiga[idx] = Number(n.nilai)
    nilaiByDefense.set(id, tiga)
  }
  const nilai = s1Trend
    ? nilaiPerSemester([...yearByDefense].map(([id, academicYearId]) => ({
        academicYearId, label: labelByYear.get(academicYearId) ?? '', nilai: nilaiByDefense.get(id) ?? [null, null, null],
      })))
    : null

  // Same verdict rule as the Hasil Prasidang page: Super Admin's decision wins.
  const rekap = buildRekapPrasidang(
    (prasidang.data ?? []) as Parameters<typeof buildRekapPrasidang>[0],
    (isian.data ?? []).map((x) => ({
      defense_id: String(x.defense_id), peran: x.peran as PeranPrasidang, hasil: x.hasil as Hasil,
      email_status: x.email_status as string, email_detail: x.email_detail, submitted_at: x.submitted_at as string,
    })),
    (keputusan.data ?? []).map((x) => ({ npm: String(x.npm), prasidang_id: x.prasidang_id as string | null, hasil: x.hasil as Hasil, alasan: String(x.alasan) })),
    new Set((sidNpm.data ?? []).map((x) => String(x.npm))),
  )

  const mendatang = sidangMendatang((defenses.data ?? []).map((d) => {
    const room = one<{ nama: string }>(d.rooms as { nama: string } | { nama: string }[] | null)
    return {
      id: String(d.id), prodi: d.prodi as Prodi, jenis: d.jenis as 'prasidang' | 'sidang',
      tanggal: String(d.tanggal), jam_mulai: String(d.jam_mulai), jam_selesai: String(d.jam_selesai),
      nama_mahasiswa: String(d.nama_mahasiswa), room_nama: room?.nama ?? null, kelompok: d.kelompok as number | null,
    }
  }), today)

  return {
    kelas,
    nilai,
    prasidang: s1 ? hitungHasilPrasidang(rekap) : null,
    mendatang,
    aktivitas: (log.data ?? []) as AuditRow[],
  }
}
