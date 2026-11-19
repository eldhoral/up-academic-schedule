'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { kirimRevisi } from '@/lib/mailer'
import { tanggalPanjang } from '@/lib/hari'
import {
  adminSidang, ANGGOTA_I_LEGACY, aksesSidang, PERAN_SIDANG_LABEL, penilaianSidangPath, todayJakarta, type PeranSidang,
} from '@/lib/penilaian/akses'
import { identitasPenguji, loadSidang, type Sidang } from '@/lib/penilaian/data'
import { bolehKirimUlang } from '@/lib/penilaian/rekap'
import {
  ASPEK_BERUBAH, SUDAH_DIKIRIM, aspekSama, cekRevisi, nilaiDariSnapshot, snapshotDariSkor, type Revisi, type SkorAspek,
} from '@/lib/penilaian/nilai'

export type Hasil = { error: string } | { ok: true; email?: string }
/** The aspek list the form showed, as [label, bobot]: a grade is refused if the rules changed while the form was open. */
export type AspekTampil = [string, number][]

const TIDAK_ADA = 'Penilaian tidak ditemukan.'
const TERKUNCI = 'Nilai sidang sudah dikunci.'
const BUKAN_SUPERADMIN = 'Hanya Super Admin yang dapat melakukan aksi ini.'

/** The unique (defense_id, peran) is the last word on a double submit (two tabs). */
const dbError = (e: { code?: string; message: string }) => (e.code === '23505' ? SUDAH_DIKIRIM : humanDbError(e))

const revalidate = (id: string) => {
  revalidatePath(penilaianSidangPath(id))
  revalidatePath('/penilaian')
}

/** The kode on the defense for a peran (a manual row isn't tied to it by the DB). */
const kodePeran = (d: Sidang['defense'], peran: PeranSidang) =>
  peran === 'ketua' ? d.penguji_kode : peran === 'anggota_1' ? d.penguji_eksternal_kode : d.pembimbing_kode

/** The yudisium a form picked, from the current choices (the DB checks the pair again). */
const pilihYudisium = (data: Sidang, label: unknown) =>
  typeof label === 'string' ? data.aturan.pilihanYudisium.find((y) => y.label === label) ?? null : null

/**
 * The examiner, its sidang and its access, re-checked on every action: actions skip the proxy's
 * profile read, and an expired EKSTERNAL is signed out (getCurrentUser returns null). RLS checks again.
 */
async function aksesAksi(defenseId: string) {
  const user = await getCurrentUser()
  const saya = user && (await identitasPenguji(user))
  if (!user || !saya) return null
  const data = await loadSidang(defenseId)
  const akses = aksesSidang(data?.defense ?? null, saya.kode, {
    submitted: new Set(Object.keys(data?.nilai ?? {}) as PeranSidang[]),
    locked: !!data?.hasil,
    today: todayJakarta(),
    akunTanggal: saya.akunTanggal,
  })
  return data && akses.kind !== 'tidak-ada' ? { user, data, akses } : null
}

/** The grade a form sent: aspek still the displayed list, every skor valid, revisi valid. */
function nilaiForm(aspek: { label: string; bobot: number }[], tampil: unknown, skor: unknown, adaRevisi: unknown, revisi: unknown) {
  if (!aspekSama(tampil, aspek)) return { error: ASPEK_BERUBAH }
  const snap = snapshotDariSkor(aspek, skor)
  if ('error' in snap) return snap
  const rev = cekRevisi(adaRevisi, revisi)
  if ('error' in rev) return rev
  return { aspek: snap.aspek, nilai: nilaiDariSnapshot(snap.aspek), ada_revisi: rev.adaRevisi, revisi: rev.revisi }
}

/** An examiner (Ketua included) grades its own peran, from the sidang date, once, in any order. The Ketua then locks with kunciSidangAction. */
export async function submitNilaiSidangAction(
  defenseId: string, peran: PeranSidang, tampil: AspekTampil, skor: string[], adaRevisi: boolean, revisi: Revisi,
): Promise<Hasil> {
  const a = await aksesAksi(defenseId)
  if (!a) return { error: TIDAK_ADA }
  const { user, data, akses } = a
  if (akses.kind === 'terkunci') return { error: TERKUNCI }
  if (akses.kind === 'belum-dibuka') return { error: `Penilaian dibuka pada ${tanggalPanjang(akses.tanggal, false)}.` }
  if (akses.kind === 'terkirim') return { error: SUDAH_DIKIRIM }
  if (akses.kind !== 'isi' || akses.peran !== peran) return { error: TIDAK_ADA }

  const n = nilaiForm(data.aturan.aspekSidang, tampil, skor, adaRevisi, revisi)
  if ('error' in n) return n

  // Session client: audit_row records the examiner as the actor; RLS (may_grade_sidang) checks again.
  const supabase = await createClient()
  const { error } = await supabase.from('nilai_sidang').insert({
    defense_id: data.defense.id, kode_dosen: user.kodeDosen, peran, ...n, sumber: 'dosen', submitted_by: user.id,
  })
  if (error) return { error: dbError(error) }

  revalidate(data.defense.id)
  return { ok: true }
}

/** Lock the sidang with a yudisium: a plain hasil_sidang insert (the DB freezes the rules and decides the email). */
async function kunci(data: Sidang, userId: string, yudisium: string): Promise<Hasil> {
  const y = pilihYudisium(data, yudisium)
  if (!y) return { error: 'Pilih yudisium.' }
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('hasil_sidang')
    .insert({ defense_id: data.defense.id, yudisium_label: y.label, yudisium_lulus: y.lulus, locked_by: userId })
    .select('email_status')
    .single()
  if (error) return { error: error.code === '23505' ? 'Nilai sidang ini sudah dikunci. Muat ulang halaman.' : humanDbError(error) }

  // The lock is committed. The send (10 s cap) only updates email_status; whatever happens, the lock stands.
  const status = row.email_status === 'menunggu' ? await kirimAman(data.defense.id) : (row.email_status as string)
  revalidate(data.defense.id)
  return { ok: true, email: status }
}

/** The Ketua locks once all three grades are sent, choosing the yudisium. Its own grade went in through submitNilaiSidangAction. */
export async function kunciSidangAction(defenseId: string, yudisium: string): Promise<Hasil> {
  const a = await aksesAksi(defenseId)
  if (!a) return { error: TIDAK_ADA }
  const { user, data, akses } = a
  if (akses.kind === 'terkunci') return { error: TERKUNCI }
  if (akses.kind === 'menunggu-anggota') {
    if (!data.defense.penguji_eksternal_kode) return { error: `${ANGGOTA_I_LEGACY}.` }
    return { error: `Menunggu ${akses.kurang.map((p) => PERAN_SIDANG_LABEL[p]).join(' dan ')}.` }
  }
  if (akses.kind !== 'kunci') return { error: TIDAK_ADA }
  return kunci(data, user.id, yudisium)
}

/** kirimRevisi that never throws: a DB problem while sending leaves email_status as it was ('menunggu'). */
async function kirimAman(defenseId: string): Promise<string> {
  try {
    return await kirimRevisi(defenseId)
  } catch (e) {
    console.error('kirimRevisi gagal:', e instanceof Error ? e.message : 'error')
    return 'menunggu'
  }
}

/** Super Admin retries a failed, partial or stuck ('menunggu' over 2 minutes) revisi email. It is not a re-send after a correction. */
export async function kirimUlangEmailAction(defenseId: string): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: BUKAN_SUPERADMIN }
  const data = await loadSidang(defenseId)
  if (!data?.hasil) return { error: TIDAK_ADA }
  if (!bolehKirimUlang(data.hasil.email_status, data.hasil.locked_at)) {
    return { error: 'Email hanya dapat dikirim ulang jika gagal, sebagian, atau masih menunggu lebih dari 2 menit.' }
  }

  const status = await kirimAman(data.defense.id)
  revalidate(data.defense.id)
  return { ok: true, email: status }
}

/** Super Admin edits a submitted grade: re-scored against the grade's own snapshot rows, revisi replaced. */
export async function editNilaiSidangAction(nilaiId: string, skor: string[], adaRevisi: boolean, revisi: Revisi): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: BUKAN_SUPERADMIN }

  const supabase = await createClient()
  const { data: row, error: readError } = await supabase
    .from('nilai_sidang').select('id, defense_id, aspek').eq('id', nilaiId).maybeSingle()
  if (readError) return { error: humanDbError(readError) }
  if (!row) return { error: TIDAK_ADA }

  const aspek = row.aspek as SkorAspek[]
  const n = nilaiForm(aspek, aspek.map((x) => [x.label, x.bobot]), skor, adaRevisi, revisi)
  if ('error' in n) return n

  const { data: updated, error } = await supabase.from('nilai_sidang').update(n).eq('id', row.id).select('id')
  if (error) return { error: humanDbError(error) }
  if (!updated?.length) return { error: 'Anda tidak memiliki izin untuk melakukan aksi ini.' }

  revalidate(row.defense_id)
  return { ok: true }
}

/** Super Admin changes the yudisium of a locked sidang. No email is re-sent. */
export async function editYudisiumAction(defenseId: string, yudisium: string): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: BUKAN_SUPERADMIN }
  const data = await loadSidang(defenseId)
  if (!data?.hasil) return { error: TIDAK_ADA }
  const y = pilihYudisium(data, yudisium)
  if (!y) return { error: 'Pilih yudisium.' }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('hasil_sidang').update({ yudisium_label: y.label, yudisium_lulus: y.lulus }).eq('defense_id', data.defense.id).select('defense_id')
  if (error) return { error: humanDbError(error) }
  if (!updated?.length) return { error: 'Anda tidak memiliki izin untuk melakukan aksi ini.' }

  revalidate(data.defense.id)
  return { ok: true }
}

/** Super Admin enters any missing grade (the Ketua's too) at any time. */
export async function inputNilaiSidangAdminAction(
  defenseId: string, peran: PeranSidang, tampil: AspekTampil, skor: string[], adaRevisi: boolean, revisi: Revisi,
): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: BUKAN_SUPERADMIN }

  const data = await loadSidang(defenseId)
  if (!data) return { error: TIDAK_ADA }
  if (data.hasil) return { error: TERKUNCI }
  if (data.nilai[peran]) return { error: SUDAH_DIKIRIM }
  if (!adminSidang(data.defense, new Set(Object.keys(data.nilai) as PeranSidang[]), false).isi.includes(peran)) {
    return { error: peran === 'anggota_1' ? `${ANGGOTA_I_LEGACY}.` : 'Dosen untuk peran ini belum diisi di jadwal sidang.' }
  }

  const n = nilaiForm(data.aturan.aspekSidang, tampil, skor, adaRevisi, revisi)
  if ('error' in n) return n

  const supabase = await createClient()
  const { error } = await supabase.from('nilai_sidang').insert({
    defense_id: data.defense.id, kode_dosen: kodePeran(data.defense, peran), peran, ...n, sumber: 'manual', submitted_by: user.id,
  })
  if (error) return { error: dbError(error) }

  revalidate(data.defense.id)
  return { ok: true }
}

/** Super Admin locks on the Ketua's behalf, at any time, once all three grades exist. The revisi email follows the DB's rule. */
export async function kunciSidangAdminAction(defenseId: string, yudisium: string): Promise<Hasil> {
  const user = await getCurrentUser()
  if (!user || !canManage(user.role)) return { error: BUKAN_SUPERADMIN }
  const data = await loadSidang(defenseId)
  if (!data) return { error: TIDAK_ADA }
  if (data.hasil) return { error: TERKUNCI }
  const ada = new Set(Object.keys(data.nilai) as PeranSidang[])
  if (!adminSidang(data.defense, ada, false).kunci) {
    const kurang = (['ketua', 'anggota_1', 'anggota_2'] as const).filter((p) => !ada.has(p))
    return { error: `Menunggu ${kurang.map((p) => PERAN_SIDANG_LABEL[p]).join(', ')}.` }
  }
  return kunci(data, user.id, yudisium)
}
