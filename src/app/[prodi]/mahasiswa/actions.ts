'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { parseProdi, type Prodi } from '@/lib/prodi'
import { manageableProdi } from '@/lib/prodi-server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { emailError, sksBobot } from '@/lib/import/tables'

export type FormState = { error: string } | { success: true } | null

function readStudentForm(formData: FormData) {
  const npm = ((formData.get('npm') as string) || '').trim()
  const nama = ((formData.get('nama') as string) || '').trim()
  const judul_skripsi = ((formData.get('judul_skripsi') as string) || '').trim()
  const email = ((formData.get('email') as string) || '').trim()
  const sks = ((formData.get('sks_sebelum') as string) || '').trim()
  const bobot = ((formData.get('bobot_sebelum') as string) || '').trim()
  const tepat_waktu = formData.get('tepat_waktu') === 'on'
  const pembimbing_1_kode = ((formData.get('pembimbing_1_kode') as string) || '').trim()
  const pembimbing_2_kode = ((formData.get('pembimbing_2_kode') as string) || '').trim()
  const tanpa_pembimbing_2 = formData.get('tanpa_pembimbing_2') === 'on'
  return { prodi: parseProdi(formData.get('prodi')), npm, nama, judul_skripsi, email, sks, bobot, tepat_waktu, pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2 }
}

type StudentForm = Omit<ReturnType<typeof readStudentForm>, 'prodi'>

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type StudentRow = {
  npm: string; nama: string; judul_skripsi: string; email: string; tepat_waktu: boolean; sks_sebelum: number | null; bobot_sebelum: number | null
  pembimbing_1_kode?: string; pembimbing_2_kode?: string | null; tanpa_pembimbing_2?: boolean
}

/** The row to save, or the reason it can't be (the DB checks, said in words). S1 needs Pembimbing I, and Pembimbing II or the explicit "tanpa" flag. */
function toRow(f: StudentForm, prodi: Prodi): { error: string } | { row: StudentRow } {
  if (!f.npm || !f.nama) return { error: 'NPM dan nama wajib diisi.' }
  if (!/^\d+$/.test(f.npm)) return { error: 'NPM hanya boleh berisi angka.' }
  const badEmail = emailError(f.email)
  if (badEmail) return { error: cap(badEmail) }
  const nilai = sksBobot(f.sks, f.bobot)
  if ('error' in nilai) return { error: cap(nilai.error) }
  const { npm, nama, judul_skripsi, email, tepat_waktu, pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2 } = f
  const row: StudentRow = { npm, nama, judul_skripsi, email, tepat_waktu, sks_sebelum: nilai.sks, bobot_sebelum: nilai.bobot }
  if (prodi === 's1') {
    if (!pembimbing_1_kode) return { error: 'Dosen Pembimbing I wajib diisi.' }
    if (tanpa_pembimbing_2) {
      Object.assign(row, { pembimbing_1_kode, pembimbing_2_kode: null, tanpa_pembimbing_2 })
    } else {
      if (!pembimbing_2_kode) return { error: 'Pilih Dosen Pembimbing II atau centang Tanpa Dosen Pembimbing II.' }
      if (pembimbing_1_kode === pembimbing_2_kode) return { error: 'Dosen Pembimbing I dan II harus berbeda.' }
      Object.assign(row, { pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2 })
    }
  }
  return { row }
}

export async function createStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...form } = readStudentForm(formData)
  const gate = await manageableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  const parsed = toRow(form, gate.prodi)
  if ('error' in parsed) return { error: parsed.error }
  const row = parsed.row

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('students').insert({ ...row, prodi: gate.prodi })
  if (dbError) return { error: humanDbError(dbError, 'NPM') }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}

export async function updateStudentAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...form } = readStudentForm(formData)
  const gate = await manageableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  const parsed = toRow(form, gate.prodi)
  if ('error' in parsed) return { error: parsed.error }
  const row = parsed.row

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('students').update(row).eq('id', id).eq('prodi', gate.prodi)
  if (dbError) return { error: humanDbError(dbError, 'NPM') }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}

export async function deleteStudentAction(prodi: Prodi, id: string): Promise<FormState> {
  const gate = await manageableProdi(prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { error } = await supabase.from('students').delete().eq('id', id).eq('prodi', gate.prodi)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}

/** The latest S1 prasidang of this student (the one an override is tied to), or null. */
async function prasidangTerbaruId(supabase: Awaited<ReturnType<typeof createClient>>, npm: string): Promise<{ id: string | null } | { error: string }> {
  const { data, error } = await supabase
    .from('defenses').select('id').eq('prodi', 's1').eq('jenis', 'prasidang').eq('npm', npm)
    .order('tanggal', { ascending: false }).order('created_at', { ascending: false }).limit(1)
  if (error) return { error: humanDbError(error) }
  return { id: data?.[0]?.id ?? null }
}

const BUKAN_SUPERADMIN: FormState = { error: 'Hanya Super Admin yang dapat memberi keputusan prasidang.' }

/** Super Admin overrides a student's prasidang verdict so the sidang can be scheduled. Tied to the latest prasidang. */
export async function simpanKeputusanAction(prodi: Prodi, npm: string, hasil: string, alasan: string): Promise<FormState> {
  if (!canManage(await getCurrentRole())) return BUKAN_SUPERADMIN
  if (prodi !== 's1') return { error: 'Keputusan prasidang hanya untuk S1.' }
  if (hasil !== 'layak' && hasil !== 'layak_revisi') return { error: 'Pilih keputusan.' }
  if (!alasan.trim()) return { error: 'Alasan wajib diisi.' }

  const supabase = await createClient()
  const p = await prasidangTerbaruId(supabase, npm)
  if ('error' in p) return p
  const { error } = await supabase
    .from('keputusan_prasidang')
    .upsert({ npm, prasidang_id: p.id, hasil, alasan: alasan.trim() }, { onConflict: 'npm' })
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  revalidatePath('/[prodi]/sidang/hasil-prasidang', 'page')
  return { success: true }
}

export async function hapusKeputusanAction(prodi: Prodi, npm: string): Promise<FormState> {
  if (!canManage(await getCurrentRole())) return BUKAN_SUPERADMIN
  if (prodi !== 's1') return { error: 'Keputusan prasidang hanya untuk S1.' }
  const supabase = await createClient()
  const { error } = await supabase.from('keputusan_prasidang').delete().eq('npm', npm)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  revalidatePath('/[prodi]/sidang/hasil-prasidang', 'page')
  return { success: true }
}
