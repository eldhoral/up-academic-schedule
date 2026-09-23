'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FormState = { error: string } | { success: true } | null

function readCourseForm(formData: FormData) {
  const kode_mk = (formData.get('kode_mk') as string)?.trim()
  const nama_mk = (formData.get('nama_mk') as string)?.trim()
  const sks = parseInt(formData.get('sks') as string, 10)
  const jenis_mk = formData.get('jenis_mk') as string
  const smt = parseInt(formData.get('smt') as string, 10)
  const kurikulum = ((formData.get('kurikulum') as string) || '2026').trim()
  return { kode_mk, nama_mk, sks, jenis_mk, smt, kurikulum }
}

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readCourseForm(formData)
  if (!row.kode_mk || !row.nama_mk) return { error: 'kode_mk dan nama_mk wajib diisi.' }
  if (!Number.isFinite(row.sks) || row.sks <= 0) return { error: 'sks harus berupa angka positif.' }
  if (row.smt < 1 || row.smt > 8) return { error: 'smt harus antara 1 dan 8.' }
  if (row.jenis_mk !== 'A' && row.jenis_mk !== 'B') return { error: 'jenis_mk harus A atau B.' }

  const supabase = await createClient()
  const { error } = await supabase.from('courses').insert(row)
  if (error) return { error: error.message }

  revalidatePath('/mata-kuliah')
  return { success: true }
}

export async function updateCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readCourseForm(formData)
  if (!row.kode_mk) return { error: 'kode_mk wajib diisi.' }
  if (!Number.isFinite(row.sks) || row.sks <= 0) return { error: 'sks harus berupa angka positif.' }
  if (row.smt < 1 || row.smt > 8) return { error: 'smt harus antara 1 dan 8.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('courses')
    .update({ nama_mk: row.nama_mk, sks: row.sks, jenis_mk: row.jenis_mk, smt: row.smt, kurikulum: row.kurikulum })
    .eq('kode_mk', row.kode_mk)
  if (error) return { error: error.message }

  revalidatePath('/mata-kuliah')
  return { success: true }
}

export async function deleteCourseAction(kodeMk: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('courses').delete().eq('kode_mk', kodeMk)
  if (error) return { error: error.message }

  revalidatePath('/mata-kuliah')
  return { success: true }
}
