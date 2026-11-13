import { createAdminClient } from '@/lib/supabase/admin'
import { lecturerDisplayName } from '@/lib/import/tables'
import { bisaDinilai, type DefenseRef, type Peran } from './akses'
import { loadAturan, type Aturan } from './aturan'
import { ipkSebelum, type SkorAspek } from './nilai'

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

export type Penilaian = {
  defense: DefensePenilaian
  ipk: number | null
  nilai: Partial<Record<Peran, NilaiRow>>
  dosen: Record<Peran, string>
  aturan: Aturan
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/**
 * One S1 prasidang with both grades, for the grading page and its actions. Admin client: a DOSEN
 * can't read defenses or students under RLS. Callers authorize first (role) and then check the
 * returned record (aksesDosen) before showing or writing anything. Null = no such S1 prasidang.
 */
export async function loadPenilaian(defenseId: string): Promise<Penilaian | null> {
  if (!UUID.test(defenseId)) return null
  const db = createAdminClient()
  const { data: d, error } = await db
    .from('defenses')
    .select('id, prodi, jenis, tanggal, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode')
    .eq('id', defenseId)
    .maybeSingle()
  if (error) throw new Error(`Gagal memuat prasidang: ${error.message}`)
  if (!d || !bisaDinilai(d)) return null
  const defense = d as DefensePenilaian

  const kode = [defense.pembimbing_kode, defense.penguji_kode].filter((k): k is string => !!k)
  const [mhs, rows, dosen, aturan] = await Promise.all([
    db.from('students').select('sks_sebelum, bobot_sebelum').eq('prodi', 's1').eq('npm', defense.npm).maybeSingle(),
    db.from('nilai_bimbingan').select('id, peran, kode_dosen, aspek, nilai, sumber, submitted_at').eq('defense_id', defense.id),
    db.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang').in('kode_dosen', kode),
    loadAturan(db, 's1'),
  ])
  const err = mhs.error ?? rows.error ?? dosen.error
  if (err) throw new Error(`Gagal memuat penilaian: ${err.message}`)

  const nilai: Partial<Record<Peran, NilaiRow>> = {}
  for (const r of rows.data ?? []) nilai[r.peran as Peran] = { ...r, nilai: Number(r.nilai) } as NilaiRow
  const nama = (k: string | null) => {
    const l = (dosen.data ?? []).find((x) => x.kode_dosen === k)
    return l ? lecturerDisplayName(l) : (k ?? '—')
  }

  return {
    defense,
    ipk: ipkSebelum(num(mhs.data?.bobot_sebelum), num(mhs.data?.sks_sebelum)),
    nilai,
    dosen: { pembimbing_1: nama(defense.pembimbing_kode), pembimbing_2: nama(defense.penguji_kode) },
    aturan,
  }
}
