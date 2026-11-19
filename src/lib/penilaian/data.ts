import { createAdminClient } from '@/lib/supabase/admin'
import { lecturerDisplayName } from '@/lib/import/tables'
import { isPenguji, type Role } from '@/lib/role-types'
import { bisaDinilaiSidang, isPrasidangS1, type BimbinganRef, type DefenseRef, type Peran, type PeranSidang, type SidangRef } from './akses'
import { loadAturan, parseAturanBeku, type Aturan, type AturanBeku } from './aturan'
import { ipkSebelum, type Revisi, type SkorAspek } from './nilai'
import type { Hasil, Jawaban, PeranPrasidang, StatusPrasidang } from './prasidang'

export type NilaiRow = {
  id: string
  peran: Peran
  kode_dosen: string
  aspek: SkorAspek[]
  nilai: number
  sumber: 'dosen' | 'manual'
  submitted_at: string
}

export type DefensePenilaian = DefenseRef & { npm: string; nama_mahasiswa: string; judul_skripsi: string }

/** The sidang a bimbingan grade sits on, with the student's Dosen Pembimbing (Data Mahasiswa). */
export type SidangBimbingan = BimbinganRef & { tanggal: string; npm: string; nama_mahasiswa: string; judul_skripsi: string }

export type Penilaian = {
  defense: SidangBimbingan
  ipk: number | null
  nilai: Partial<Record<Peran, NilaiRow>>
  dosen: Record<Peran, string>
  /** The Ketua's lock, null until locked. */
  kunci: { lockedAt: string; lulus: boolean } | null
  aturan: Aturan
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/**
 * One S1 sidang with both bimbingan grades, for the grading page and its actions. Admin client: a DOSEN
 * can't read defenses or students under RLS. Callers authorize first (role) and then check the
 * returned record (aksesBimbingan) before showing or writing anything. Null = no such S1 sidang.
 */
export async function loadPenilaian(defenseId: string): Promise<Penilaian | null> {
  if (!UUID.test(defenseId)) return null
  const db = createAdminClient()
  const { data: d, error } = await db
    .from('defenses')
    .select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi')
    .eq('id', defenseId)
    .maybeSingle()
  if (error) throw new Error(`Gagal memuat sidang: ${error.message}`)
  if (!d || !bisaDinilaiSidang(d)) return null

  const [mhs, rows, hasil, aturan] = await Promise.all([
    db.from('students').select('sks_sebelum, bobot_sebelum, pembimbing_1_kode, pembimbing_2_kode').eq('prodi', 's1').eq('npm', d.npm).maybeSingle(),
    db.from('nilai_bimbingan').select('id, peran, kode_dosen, aspek, nilai, sumber, submitted_at').eq('defense_id', d.id),
    db.from('hasil_sidang').select('locked_at, yudisium_lulus').eq('defense_id', d.id).maybeSingle(),
    loadAturan(db, 's1'),
  ])
  const err = mhs.error ?? rows.error ?? hasil.error
  if (err) throw new Error(`Gagal memuat penilaian: ${err.message}`)
  const defense: SidangBimbingan = {
    ...(d as Omit<SidangBimbingan, 'pembimbing_1_kode' | 'pembimbing_2_kode'>),
    pembimbing_1_kode: mhs.data?.pembimbing_1_kode ?? null,
    pembimbing_2_kode: mhs.data?.pembimbing_2_kode ?? null,
  }

  const nilai: Partial<Record<Peran, NilaiRow>> = {}
  for (const r of rows.data ?? []) nilai[r.peran as Peran] = { ...r, nilai: Number(r.nilai) } as NilaiRow
  // A submitted grade names its own dosen; an open slot names the student's current Pembimbing.
  const kode = (p: Peran) => nilai[p]?.kode_dosen ?? (p === 'pembimbing_1' ? defense.pembimbing_1_kode : defense.pembimbing_2_kode)
  const kodes = (['pembimbing_1', 'pembimbing_2'] as const).map(kode).filter((k): k is string => !!k)
  const { data: dosen, error: dErr } = await db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang').in('kode_dosen', kodes)
  if (dErr) throw new Error(`Gagal memuat penilaian: ${dErr.message}`)
  const nama = (k: string | null) => {
    const l = (dosen ?? []).find((x) => x.kode_dosen === k)
    return l ? lecturerDisplayName(l) : (k ?? '—')
  }

  return {
    defense,
    ipk: ipkSebelum(num(mhs.data?.bobot_sebelum), num(mhs.data?.sks_sebelum)),
    nilai,
    dosen: { pembimbing_1: nama(kode('pembimbing_1')), pembimbing_2: nama(kode('pembimbing_2')) },
    kunci: hasil.data ? { lockedAt: hasil.data.locked_at as string, lulus: !!hasil.data.yudisium_lulus } : null,
    aturan,
  }
}

// ---- Sidang Skripsi (S1)

export type NilaiSidangRow = {
  id: string
  peran: PeranSidang
  kode_dosen: string
  aspek: SkorAspek[]
  nilai: number
  ada_revisi: boolean
  revisi: Revisi
  sumber: 'dosen' | 'manual'
  submitted_at: string
}

/** aturan is the frozen copy, null when the stored jsonb is unusable (the grading page then shows ALASAN_ATURAN_RUSAK, like the recap). */
export type HasilRow = {
  yudisium_label: string
  yudisium_lulus: boolean
  aturan: AturanBeku | null
  locked_at: string
  email_status: string
}

export type DefenseSidang = SidangRef & { npm: string; nama_mahasiswa: string; judul_skripsi: string }

export type Sidang = {
  defense: DefenseSidang
  /** The student's facts for the grading page and the berita acara. */
  student: {
    ipk: number | null
    sks: number | null
    bobot: number | null
    tepatWaktu: boolean
    pembimbing1: string | null
    pembimbing2: string | null
  }
  ruang: string | null
  nilai: Partial<Record<PeranSidang, NilaiSidangRow>>
  hasil: HasilRow | null
  dosen: Record<PeranSidang, string>
  aturan: Aturan
}

export const SIDANG_COLS = 'id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode, penguji_eksternal_kode'

/**
 * One S1 sidang with all three grades and the lock, for the grading page and its actions. Admin client,
 * as loadPenilaian: callers authorize first and check the record (aksesSidang) before showing or writing,
 * and show an examiner only what RLS would (its own grade; the Ketua all three). Null = no such S1 sidang.
 */
export async function loadSidang(defenseId: string): Promise<Sidang | null> {
  if (!UUID.test(defenseId)) return null
  const db = createAdminClient()
  const { data: d, error } = await db.from('defenses').select(SIDANG_COLS).eq('id', defenseId).maybeSingle()
  if (error) throw new Error(`Gagal memuat sidang: ${error.message}`)
  if (!d || !bisaDinilaiSidang(d)) return null
  const defense = d as DefenseSidang

  // ponytail: the whole lecturer list (a few dozen rows) also names the student's Pembimbing in one round trip.
  const [mhs, rows, hasil, dosen, aturan, room] = await Promise.all([
    db.from('students').select('sks_sebelum, bobot_sebelum, tepat_waktu, pembimbing_1_kode, pembimbing_2_kode').eq('prodi', 's1').eq('npm', defense.npm).maybeSingle(),
    db.from('nilai_sidang').select('id, peran, kode_dosen, aspek, nilai, ada_revisi, revisi, sumber, submitted_at').eq('defense_id', defense.id),
    db.from('hasil_sidang').select('yudisium_label, yudisium_lulus, aturan, locked_at, email_status').eq('defense_id', defense.id).maybeSingle(),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang'),
    loadAturan(db, 's1'),
    db.from('defenses').select('rooms(nama)').eq('id', defense.id).maybeSingle(),
  ])
  const err = mhs.error ?? rows.error ?? hasil.error ?? dosen.error ?? room.error
  if (err) throw new Error(`Gagal memuat penilaian sidang: ${err.message}`)

  const nilai: Partial<Record<PeranSidang, NilaiSidangRow>> = {}
  for (const r of rows.data ?? []) nilai[r.peran as PeranSidang] = { ...r, nilai: Number(r.nilai) } as NilaiSidangRow
  const nama = (k: string | null) => {
    const l = (dosen.data ?? []).find((x) => x.kode_dosen === k)
    return l ? lecturerDisplayName(l) : (k ?? '—')
  }

  return {
    defense,
    student: {
      ipk: ipkSebelum(num(mhs.data?.bobot_sebelum), num(mhs.data?.sks_sebelum)),
      sks: num(mhs.data?.sks_sebelum),
      bobot: num(mhs.data?.bobot_sebelum),
      tepatWaktu: !!mhs.data?.tepat_waktu,
      pembimbing1: mhs.data?.pembimbing_1_kode ? nama(mhs.data.pembimbing_1_kode) : null,
      pembimbing2: mhs.data?.pembimbing_2_kode ? nama(mhs.data.pembimbing_2_kode) : null,
    },
    ruang: (() => {
      const r = room.data?.rooms as { nama: string } | { nama: string }[] | null | undefined
      const one = Array.isArray(r) ? r[0] : r
      return one ? `Ruang ${one.nama}` : null
    })(),
    nilai,
    hasil: hasil.data ? { ...hasil.data, aturan: parseAturanBeku(hasil.data.aturan) } as HasilRow : null,
    dosen: { ketua: nama(defense.penguji_kode), anggota_1: nama(defense.penguji_eksternal_kode), anggota_2: nama(defense.pembimbing_kode) },
    aturan,
  }
}

/**
 * Who grades as this user: its kode, plus the account's day for an EKSTERNAL (admin client: akun_eksternal
 * is staff-only under RLS). Null for staff, and for a DOSEN/EKSTERNAL that can't grade (no kode, no day row).
 */
export async function identitasPenguji(user: { id: string; role: Role; kodeDosen: string | null }): Promise<{ kode: string; akunTanggal?: string } | null> {
  if (!isPenguji(user.role) || !user.kodeDosen) return null
  if (user.role !== 'EKSTERNAL') return { kode: user.kodeDosen }
  const { data, error } = await createAdminClient().from('akun_eksternal').select('tanggal').eq('user_id', user.id).maybeSingle()
  if (error) throw new Error(`Gagal memuat akun penguji: ${error.message}`)
  return data ? { kode: user.kodeDosen, akunTanggal: data.tanggal as string } : null
}

// ---- Berita Acara Prasidang (S1)

export type BeritaAcaraRow = {
  id: string
  peran: PeranPrasidang
  kode_dosen: string
  jawaban: Jawaban[]
  hasil: Hasil
  submitted_at: string
}

export type BeritaAcara = {
  defense: DefensePenilaian
  isian: Partial<Record<PeranPrasidang, BeritaAcaraRow>>
  dosen: Record<PeranPrasidang, string>
  status: StatusPrasidang
  keputusan: { hasil: Hasil; alasan: string } | null
  aturan: Aturan
}

/**
 * One S1 prasidang with both berita acara, the student's gate status and the override that applies.
 * Admin client, as loadPenilaian: callers authorize first and check the record (aksesBeritaAcara)
 * before showing or writing, and show a dosen only its own berita acara. Null = no such S1 prasidang.
 */
export async function loadBeritaAcara(defenseId: string): Promise<BeritaAcara | null> {
  if (!UUID.test(defenseId)) return null
  const db = createAdminClient()
  const { data: d, error } = await db
    .from('defenses')
    .select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode')
    .eq('id', defenseId)
    .maybeSingle()
  if (error) throw new Error(`Gagal memuat prasidang: ${error.message}`)
  if (!d || !isPrasidangS1(d)) return null
  const defense = d as DefensePenilaian

  const kode = [defense.pembimbing_kode, defense.penguji_kode].filter((k): k is string => !!k)
  const [rows, dosen, status, keputusan, aturan] = await Promise.all([
    db.from('berita_acara_prasidang').select('id, peran, kode_dosen, jawaban, hasil, submitted_at').eq('defense_id', defense.id),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang').in('kode_dosen', kode),
    db.rpc('status_prasidang', { p_npm: defense.npm }),
    db.from('keputusan_prasidang').select('prasidang_id, hasil, alasan').eq('npm', defense.npm).maybeSingle(),
    loadAturan(db, 's1'),
  ])
  const err = rows.error ?? dosen.error ?? status.error ?? keputusan.error
  if (err) throw new Error(`Gagal memuat berita acara: ${err.message}`)

  const isian: Partial<Record<PeranPrasidang, BeritaAcaraRow>> = {}
  for (const r of rows.data ?? []) isian[r.peran as PeranPrasidang] = r as BeritaAcaraRow
  const nama = (k: string | null) => {
    const l = (dosen.data ?? []).find((x) => x.kode_dosen === k)
    return l ? lecturerDisplayName(l) : (k ?? '—')
  }
  // The override shown is the one that applies to this prasidang (same rule as status_prasidang).
  const k = keputusan.data
  return {
    defense,
    isian,
    dosen: { pendamping: nama(defense.pembimbing_kode), pembahas: nama(defense.penguji_kode) },
    status: status.data as StatusPrasidang,
    keputusan: k && k.prasidang_id === defense.id ? { hasil: k.hasil as Hasil, alasan: k.alasan } : null,
    aturan,
  }
}
