'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage, isDosen } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { tanggalPanjang } from '@/lib/hari'
import { aksesDosen, bolehInputLama, penilaianPath, todayJakarta, type Peran } from '@/lib/penilaian/akses'
import { loadPenilaian } from '@/lib/penilaian/data'
import { nilaiDariSnapshot, snapshotDariSkor, type SkorAspek } from '@/lib/penilaian/nilai'

export type Hasil = { error: string } | { ok: true }

const TIDAK_ADA = 'Penilaian tidak ditemukan.'
const SUDAH = 'Nilai sudah dikirim.'
const PERAN: readonly string[] = ['pembimbing_1', 'pembimbing_2']

/** The unique (defense_id, peran) is the last word on a double submit (two tabs). */
const dbError = (e: { code?: string; message: string }) => (e.code === '23505' ? SUDAH : humanDbError(e))

/** A DOSEN grades its own peran, from the prasidang date, once. Every rule is re-checked here; RLS checks them again. */
export async function submitNilaiAction(defenseId: string, peran: Peran, skor: string[]): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !isDosen(user.role) || !user.kodeDosen) return { error: TIDAK_ADA }

  const data = await loadPenilaian(defenseId)
  const submitted = new Set(Object.keys(data?.nilai ?? {}) as Peran[])
  const akses = aksesDosen(data?.defense ?? null, user.kodeDosen, submitted, todayJakarta())
  if (!data || akses.kind === 'tidak-ada') return { error: TIDAK_ADA }
  if (akses.kind === 'belum-dibuka') return { error: `Penilaian dibuka pada ${tanggalPanjang(akses.tanggal, false)}.` }
  if (akses.peran !== peran) return { error: TIDAK_ADA }
  if (akses.kind === 'terkirim') return { error: SUDAH }

  const snap = snapshotDariSkor(data.aturan.aspekBimbingan, skor)
  if ('error' in snap) return snap

  // Session client: audit_row records the dosen as the actor.
  const supabase = await createClient()
  const { error } = await supabase.from('nilai_bimbingan').insert({
    defense_id: data.defense.id, kode_dosen: user.kodeDosen, peran, aspek: snap.aspek,
    nilai: nilaiDariSnapshot(snap.aspek), sumber: 'dosen', submitted_by: user.id,
  })
  if (error) return { error: dbError(error) }

  revalidatePath(penilaianPath(data.defense.id))
  revalidatePath('/penilaian')
  return { ok: true }
}

/** Super Admin edits a submitted grade: only aspek and nilai, re-scored against the grade's own snapshot rows. */
export async function editNilaiAction(nilaiId: string, skor: string[]): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: 'Hanya Super Admin yang dapat mengubah nilai.' }

  const supabase = await createClient()
  const { data: row, error: readError } = await supabase
    .from('nilai_bimbingan').select('id, defense_id, aspek').eq('id', nilaiId).maybeSingle()
  if (readError) return { error: humanDbError(readError) }
  if (!row) return { error: TIDAK_ADA }

  // Labels and bobot from the stored row, never the current aspek list (snapshot rule).
  const snap = snapshotDariSkor(row.aspek as SkorAspek[], skor)
  if ('error' in snap) return snap

  const { data: updated, error } = await supabase
    .from('nilai_bimbingan')
    .update({ aspek: snap.aspek, nilai: nilaiDariSnapshot(snap.aspek) })
    .eq('id', row.id)
    .select('id')
  if (error) return { error: humanDbError(error) }
  if (!updated?.length) return { error: 'Anda tidak memiliki izin untuk melakukan aksi ini.' }

  revalidatePath(penilaianPath(row.defense_id))
  return { ok: true }
}

/** Super Admin enters a missing grade from the old xlsx, only on a prasidang before tanggal mulai penilaian. */
export async function inputNilaiLamaAction(defenseId: string, peran: Peran, skor: string[]): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: 'Hanya Super Admin yang dapat memasukkan nilai lama.' }
  if (!PERAN.includes(peran)) return { error: TIDAK_ADA }

  const data = await loadPenilaian(defenseId)
  if (!data) return { error: TIDAK_ADA }
  if (!bolehInputLama(data.defense, data.aturan.tanggalMulai)) {
    return { error: 'Nilai lama hanya dapat dimasukkan untuk prasidang sebelum tanggal mulai penilaian.' }
  }
  if (data.nilai[peran]) return { error: SUDAH }
  // The DB doesn't tie kode_dosen to the peran on a manual row, so it is taken from the defense here.
  const kode = peran === 'pembimbing_1' ? data.defense.pembimbing_kode : data.defense.penguji_kode
  if (!kode) return { error: 'Dosen untuk peran ini belum diisi di jadwal prasidang.' }

  const snap = snapshotDariSkor(data.aturan.aspekBimbingan, skor)
  if ('error' in snap) return snap

  const supabase = await createClient()
  const { error } = await supabase.from('nilai_bimbingan').insert({
    defense_id: data.defense.id, kode_dosen: kode, peran, aspek: snap.aspek,
    nilai: nilaiDariSnapshot(snap.aspek), sumber: 'manual', submitted_by: user.id,
  })
  if (error) return { error: dbError(error) }

  revalidatePath(penilaianPath(data.defense.id))
  return { ok: true }
}
