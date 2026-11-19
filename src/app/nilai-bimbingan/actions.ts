'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage, isDosen } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { tanggalPanjang } from '@/lib/hari'
import { aksesBimbingan, penilaianPath, todayJakarta, type Peran } from '@/lib/penilaian/akses'
import { loadPenilaian } from '@/lib/penilaian/data'
import { ASPEK_BERUBAH, SUDAH_DIKIRIM, aspekSama, nilaiDariSnapshot, snapshotDariSkor, type SkorAspek } from '@/lib/penilaian/nilai'

export type Hasil = { error: string } | { ok: true }

const TIDAK_ADA = 'Penilaian tidak ditemukan.'
const PERAN: readonly string[] = ['pembimbing_1', 'pembimbing_2']

/** The unique (defense_id, peran) is the last word on a double submit (two tabs, or the dosen and Super Admin). */
const dbError = (e: { code?: string; message: string }) => (e.code === '23505' ? SUDAH_DIKIRIM : humanDbError(e))

/** The aspek list the form showed, as [label, bobot]: a grade is refused if the rules changed while the form was open. */
export type AspekTampil = [string, number][]

/** A Dosen Pembimbing grades its own slot, after the Ketua's lulus lock, within the window, once. RLS checks again. */
export async function submitNilaiAction(defenseId: string, peran: Peran, tampil: AspekTampil, skor: string[]): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !isDosen(user.role) || !user.kodeDosen) return { error: TIDAK_ADA }

  const data = await loadPenilaian(defenseId)
  const akses = aksesBimbingan(data?.defense ?? null, user.kodeDosen, {
    submitted: new Set(Object.keys(data?.nilai ?? {}) as Peran[]),
    kunci: data?.kunci ?? null,
    today: todayJakarta(),
    batasHari: data?.aturan.batasHariBimbingan ?? 0,
  })
  if (!data || akses.kind === 'tidak-ada') return { error: TIDAK_ADA }
  if (akses.kind === 'terkirim') return { error: SUDAH_DIKIRIM }
  if (akses.kind === 'menunggu-kunci') return { error: 'Penilaian bimbingan dibuka setelah sidang dikunci Ketua.' }
  if (akses.kind === 'tidak-lulus') return { error: 'Sidang tidak lulus: nilai bimbingan tidak dibuka.' }
  if (akses.kind === 'lewat') return { error: `Batas pengisian sudah lewat (${tanggalPanjang(akses.batas, false)}). Hubungi admin akademik.` }
  if (akses.peran !== peran) return { error: TIDAK_ADA }
  if (!aspekSama(tampil, data.aturan.aspekBimbingan)) return { error: ASPEK_BERUBAH }

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

/** Super Admin enters a missing grade at any time, for the student's Pembimbing in that slot. */
export async function inputNilaiAdminAction(defenseId: string, peran: Peran, tampil: AspekTampil, skor: string[]): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: 'Hanya Super Admin yang dapat memasukkan nilai.' }
  if (!PERAN.includes(peran)) return { error: TIDAK_ADA }

  const data = await loadPenilaian(defenseId)
  if (!data) return { error: TIDAK_ADA }
  if (data.nilai[peran]) return { error: SUDAH_DIKIRIM }
  const kode = peran === 'pembimbing_1' ? data.defense.pembimbing_1_kode : data.defense.pembimbing_2_kode
  if (!kode) return { error: 'Dosen Pembimbing untuk peran ini belum diisi di Data Mahasiswa.' }
  if (!aspekSama(tampil, data.aturan.aspekBimbingan)) return { error: ASPEK_BERUBAH }

  const snap = snapshotDariSkor(data.aturan.aspekBimbingan, skor)
  if ('error' in snap) return snap

  const supabase = await createClient()
  const { error } = await supabase.from('nilai_bimbingan').insert({
    defense_id: data.defense.id, kode_dosen: kode, peran, aspek: snap.aspek,
    nilai: nilaiDariSnapshot(snap.aspek), sumber: 'manual', submitted_by: user.id,
  })
  if (error) return { error: dbError(error) }

  revalidatePath(penilaianPath(data.defense.id))
  revalidatePath('/penilaian')
  return { ok: true }
}
