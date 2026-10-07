'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { parseProdi, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'

export type FormState = { error: string } | { success: true } | null

function readStudentForm(formData: FormData) {
  const npm = ((formData.get('npm') as string) || '').trim()
  const nama = ((formData.get('nama') as string) || '').trim()
  const judul_skripsi = ((formData.get('judul_skripsi') as string) || '').trim()
  return { prodi: parseProdi(formData.get('prodi')), npm, nama, judul_skripsi }
}

function invalid(row: { npm: string; nama: string }): string | null {
  if (!row.npm || !row.nama) return 'NPM dan nama wajib diisi.'
  if (!/^\d+$/.test(row.npm)) return 'NPM hanya boleh berisi angka.'
  return null
}

export async function createStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...row } = readStudentForm(formData)
  const gate = await writableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  const error = invalid(row)
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('students').insert({ ...row, prodi: gate.prodi })
  if (dbError) return { error: humanDbError(dbError, 'NPM') }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}

export async function updateStudentAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...row } = readStudentForm(formData)
  const gate = await writableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  const error = invalid(row)
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('students').update(row).eq('id', id).eq('prodi', gate.prodi)
  if (dbError) return { error: humanDbError(dbError, 'NPM') }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}

export async function deleteStudentAction(prodi: Prodi, id: string): Promise<FormState> {
  const gate = await writableProdi(prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { error } = await supabase.from('students').delete().eq('id', id).eq('prodi', gate.prodi)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/mahasiswa', 'page')
  return { success: true }
}
