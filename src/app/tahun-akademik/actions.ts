'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { saveAcademicYear, type SaveStep } from './save-year'

export type FormState = { error: string } | { success: true } | null

function readForm(formData: FormData) {
  const id = (formData.get('id') as string)?.trim()
  const label = (formData.get('label') as string)?.trim()
  const is_active = formData.get('is_active') === 'on'
  // Empty date inputs mean "not set yet": the calendar feed then leaves kuliah out.
  const mulai_kuliah = ((formData.get('mulai_kuliah') as string) || '').trim() || null
  const selesai_kuliah = ((formData.get('selesai_kuliah') as string) || '').trim() || null
  return { id, label, is_active, mulai_kuliah, selesai_kuliah }
}

function kuliahDatesError(mulai: string | null, selesai: string | null): string | null {
  return mulai && selesai && selesai < mulai ? 'Selesai perkuliahan tidak boleh sebelum mulai perkuliahan.' : null
}

export async function createAcademicYearAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { id, label, is_active, mulai_kuliah, selesai_kuliah } = readForm(formData)
  if (!id) return { error: 'ID wajib diisi.' }
  if (!label) return { error: 'Label wajib diisi.' }

  const datesError = kuliahDatesError(mulai_kuliah, selesai_kuliah)
  if (datesError) return { error: datesError }

  const supabase = await createClient()
  const failed = await saveAcademicYear(supabase, { id, isNew: true, fields: { label, mulai_kuliah, selesai_kuliah }, isActive: is_active })
  revalidatePath('/tahun-akademik')
  return failed ? { error: saveErrorMessage(failed) } : { success: true }
}

export async function updateAcademicYearAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { label, is_active, mulai_kuliah, selesai_kuliah } = readForm(formData)
  if (!label) return { error: 'Label wajib diisi.' }

  const datesError = kuliahDatesError(mulai_kuliah, selesai_kuliah)
  if (datesError) return { error: datesError }

  const supabase = await createClient()
  const failed = await saveAcademicYear(supabase, { id, isNew: false, fields: { label, mulai_kuliah, selesai_kuliah }, isActive: is_active })
  revalidatePath('/tahun-akademik')
  return failed ? { error: saveErrorMessage(failed) } : { success: true }
}

function saveErrorMessage({ step, error }: { step: SaveStep; error: Parameters<typeof humanDbError>[0] }): string {
  if (step === 'save') return humanDbError(error, 'Tahun akademik')
  if (step === 'activate') return `Tahun akademik tersimpan, tetapi belum aktif: ${humanDbError(error)}`
  return `Tahun akademik ini sudah aktif, tetapi tahun akademik lain belum dinonaktifkan: ${humanDbError(error)} Simpan sekali lagi.`
}

export async function deleteAcademicYearAction(id: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('academic_years').delete().eq('id', id)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/tahun-akademik')
  return { success: true }
}
