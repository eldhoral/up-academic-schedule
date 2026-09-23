'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'

export type FormState = { error: string } | { success: true } | null

function readForm(formData: FormData) {
  const id = (formData.get('id') as string)?.trim()
  const label = (formData.get('label') as string)?.trim()
  const is_active = formData.get('is_active') === 'on'
  return { id, label, is_active }
}

export async function createAcademicYearAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { id, label, is_active } = readForm(formData)
  if (!id) return { error: 'ID wajib diisi.' }
  if (!label) return { error: 'Label wajib diisi.' }

  const supabase = await createClient()

  if (is_active) {
    const { error } = await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true)
    if (error) return { error: humanDbError(error) }
  }

  const { error } = await supabase.from('academic_years').insert({ id, label, is_active })
  if (error) return { error: humanDbError(error, 'Tahun akademik') }

  revalidatePath('/tahun-akademik')
  return { success: true }
}

export async function updateAcademicYearAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { label, is_active } = readForm(formData)
  if (!label) return { error: 'Label wajib diisi.' }

  const supabase = await createClient()

  if (is_active) {
    const { error } = await supabase.from('academic_years').update({ is_active: false }).eq('is_active', true).neq('id', id)
    if (error) return { error: humanDbError(error) }
  }

  const { error } = await supabase.from('academic_years').update({ label, is_active }).eq('id', id)
  if (error) return { error: humanDbError(error, 'Tahun akademik') }

  revalidatePath('/tahun-akademik')
  return { success: true }
}

export async function deleteAcademicYearAction(id: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('academic_years').delete().eq('id', id)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/tahun-akademik')
  return { success: true }
}
