'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentUser, isDosen } from '@/lib/roles'
import { kirimCatatanPrasidang } from '@/lib/mailer'
import { bolehKirimUlang } from '@/lib/penilaian/rekap'
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

  // The insert is committed with email_status 'menunggu'; the mail (PDF + SMTP caps) goes after the response.
  after(() => kirimAman(data.defense.id))
  revalidatePath(beritaAcaraPath(data.defense.id))
  revalidatePath('/penilaian')
  return { ok: true }
}

/** kirimCatatanPrasidang that never throws: a DB problem leaves email_status as it was. */
async function kirimAman(defenseId: string): Promise<string> {
  try {
    return await kirimCatatanPrasidang(defenseId)
  } catch (e) {
    console.error('kirimCatatanPrasidang gagal:', e instanceof Error ? e.message : 'error')
    return 'menunggu'
  }
}

/** Super Admin retries a failed, partial or stuck ('menunggu' over 2 minutes) catatan prasidang email. */
export async function kirimUlangCatatanAction(defenseId: string): Promise<HasilAksi> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: 'Hanya Super Admin yang dapat mengirim ulang email.' }
  const ba = (await loadBeritaAcara(defenseId))?.isian.pendamping
  if (!ba) return { error: TIDAK_ADA }
  if (!bolehKirimUlang(ba.email_status, ba.submitted_at)) {
    return { error: 'Email hanya dapat dikirim ulang jika gagal, sebagian, atau masih menunggu lebih dari 2 menit.' }
  }
  await kirimAman(defenseId)
  revalidatePath(beritaAcaraPath(defenseId))
  return { ok: true }
}
