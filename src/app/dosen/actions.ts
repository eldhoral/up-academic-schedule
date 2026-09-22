'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FormState = { error: string } | { success: true } | null

function readLecturerForm(formData: FormData) {
  const kode_dosen = (formData.get('kode_dosen') as string)?.trim()
  const nidn = ((formData.get('nidn') as string) || '').trim()
  const nama = (formData.get('nama') as string)?.trim()
  const gelar_depan = ((formData.get('gelar_depan') as string) || '').trim()
  const gelar_belakang = ((formData.get('gelar_belakang') as string) || '').trim()
  return { kode_dosen, nidn, nama, gelar_depan, gelar_belakang }
}

export async function createLecturerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readLecturerForm(formData)
  if (!row.kode_dosen || !row.nama) return { error: 'kode_dosen and nama are required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('lecturers').insert(row)
  if (error) return { error: error.message }

  revalidatePath('/dosen')
  return { success: true }
}

export async function updateLecturerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readLecturerForm(formData)
  if (!row.kode_dosen) return { error: 'kode_dosen is required.' }
  if (!row.nama) return { error: 'nama is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lecturers')
    .update({ nidn: row.nidn, nama: row.nama, gelar_depan: row.gelar_depan, gelar_belakang: row.gelar_belakang })
    .eq('kode_dosen', row.kode_dosen)
  if (error) return { error: error.message }

  revalidatePath('/dosen')
  return { success: true }
}

export async function deleteLecturerAction(kodeDosen: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('lecturers').delete().eq('kode_dosen', kodeDosen)
  if (error) return { error: error.message }

  revalidatePath('/dosen')
  return { success: true }
}
