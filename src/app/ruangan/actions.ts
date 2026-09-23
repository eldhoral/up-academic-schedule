'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'

export type FormState = { error: string } | { success: true } | null

function readRoomForm(formData: FormData) {
  const nama = (formData.get('nama') as string)?.trim()
  const kapasitas = parseInt(formData.get('kapasitas') as string, 10)
  const keterangan = ((formData.get('keterangan') as string) || '').trim()
  const active = formData.get('active') === 'on'
  return { nama, kapasitas: Number.isFinite(kapasitas) ? kapasitas : 0, keterangan, active }
}

export async function createRoomAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readRoomForm(formData)
  if (!row.nama) return { error: 'Nama wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.from('rooms').insert(row)
  if (error) return { error: humanDbError(error, 'Nama ruangan') }

  revalidatePath('/ruangan')
  return { success: true }
}

export async function updateRoomAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const row = readRoomForm(formData)
  if (!row.nama) return { error: 'Nama wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.from('rooms').update(row).eq('id', id)
  if (error) return { error: humanDbError(error, 'Nama ruangan') }

  revalidatePath('/ruangan')
  return { success: true }
}

export async function deleteRoomAction(id: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/ruangan')
  return { success: true }
}
