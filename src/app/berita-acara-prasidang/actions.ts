'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, isDosen } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { tanggalPanjang } from '@/lib/hari'
import { aksesBeritaAcara, todayJakarta } from '@/lib/penilaian/akses'
import { loadBeritaAcara } from '@/lib/penilaian/data'
import type { Pertanyaan } from '@/lib/penilaian/aturan'
import { beritaAcaraPath, cekJawaban, HASIL, SUDAH_DIKIRIM_BA, type Hasil, type PeranPrasidang } from '@/lib/penilaian/prasidang'

export type HasilAksi = { error: string } | { ok: true }

const TIDAK_ADA = 'Berita acara tidak ditemukan.'

/** A DOSEN fills its own peran, from the prasidang date, once. Every rule is re-checked here; RLS checks them again. */
export async function submitBeritaAcaraAction(
  defenseId: string, peran: PeranPrasidang, tampil: Pertanyaan[], ya: (boolean | null)[], catatan: string[], hasil: Hasil,
): Promise<HasilAksi> {
  const user = await getCurrentUser()
  if (!user || !isDosen(user.role) || !user.kodeDosen) return { error: TIDAK_ADA }

  const data = await loadBeritaAcara(defenseId)
  const submitted = new Set(Object.keys(data?.isian ?? {}) as PeranPrasidang[])
  const akses = aksesBeritaAcara(data?.defense ?? null, user.kodeDosen, submitted, todayJakarta())
  if (!data || akses.kind === 'tidak-ada') return { error: TIDAK_ADA }
  if (akses.kind === 'belum-dibuka') return { error: `Berita acara dibuka pada ${tanggalPanjang(akses.tanggal, false)}.` }
  if (akses.peran !== peran) return { error: TIDAK_ADA }
  if (akses.kind === 'terkirim') return { error: SUDAH_DIKIRIM_BA }
  if (!HASIL.includes(hasil)) return { error: 'Pilih hasil prasidang.' }

  const j = cekJawaban(data.aturan.pertanyaanPrasidang, tampil, ya, catatan)
  if ('error' in j) return j

  // Session client: audit_row records the dosen as the actor.
  const supabase = await createClient()
  const { error } = await supabase.from('berita_acara_prasidang').insert({
    defense_id: data.defense.id, kode_dosen: user.kodeDosen, peran, jawaban: j.jawaban, hasil, submitted_by: user.id,
  })
  // The unique (defense_id, peran) is the last word on a double submit (two tabs).
  if (error) return { error: error.code === '23505' ? SUDAH_DIKIRIM_BA : humanDbError(error) }

  revalidatePath(beritaAcaraPath(data.defense.id))
  revalidatePath('/penilaian')
  return { ok: true }
}
