'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { parseProdi, type Prodi } from '@/lib/prodi'
import { manageableProdi } from '@/lib/prodi-server'
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
  return { prodi: parseProdi(formData.get('prodi')), npm, nama, judul_skripsi, email, sks, bobot, tepat_waktu }
}

type StudentForm = Omit<ReturnType<typeof readStudentForm>, 'prodi'>

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The row to save, or the reason it can't be (the DB checks, said in words). */
function toRow(f: StudentForm):
  | { error: string }
  | { row: { npm: string; nama: string; judul_skripsi: string; email: string; tepat_waktu: boolean; sks_sebelum: number | null; bobot_sebelum: number | null } } {
  if (!f.npm || !f.nama) return { error: 'NPM dan nama wajib diisi.' }
  if (!/^\d+$/.test(f.npm)) return { error: 'NPM hanya boleh berisi angka.' }
  const badEmail = emailError(f.email)
  if (badEmail) return { error: cap(badEmail) }
  const nilai = sksBobot(f.sks, f.bobot)
  if ('error' in nilai) return { error: cap(nilai.error) }
  const { npm, nama, judul_skripsi, email, tepat_waktu } = f
  return { row: { npm, nama, judul_skripsi, email, tepat_waktu, sks_sebelum: nilai.sks, bobot_sebelum: nilai.bobot } }
}

export async function createStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...form } = readStudentForm(formData)
  const gate = await manageableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  const parsed = toRow(form)
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
  const parsed = toRow(form)
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
