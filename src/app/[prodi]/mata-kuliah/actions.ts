'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { parseProdi, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'

export type FormState = { error: string } | { success: true } | null

function readCourseForm(formData: FormData) {
  const kode_mk = (formData.get('kode_mk') as string)?.trim()
  const nama_mk = (formData.get('nama_mk') as string)?.trim()
  const sks = parseInt(formData.get('sks') as string, 10)
  const jenis_mk = formData.get('jenis_mk') as string
  const smt = parseInt(formData.get('smt') as string, 10)
  const kurikulum = ((formData.get('kurikulum') as string) || '2026').trim()
  const prodi = parseProdi(formData.get('prodi'))
  return { prodi, kode_mk, nama_mk, sks, jenis_mk, smt, kurikulum }
}

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...row } = readCourseForm(formData)
  const gate = await writableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  if (!row.kode_mk || !row.nama_mk) return { error: 'Kode MK dan Nama MK wajib diisi.' }
  if (!Number.isFinite(row.sks) || row.sks <= 0) return { error: 'SKS harus berupa angka positif.' }
  const maxSmt = PRODI_CONFIG[gate.prodi].semesters
  if (row.smt < 1 || row.smt > maxSmt) return { error: `Semester harus antara 1 dan ${maxSmt}.` }
  if (row.jenis_mk !== 'A' && row.jenis_mk !== 'B') return { error: 'Jenis harus Wajib atau Pilihan.' }

  const supabase = await createClient()
  const { error } = await supabase.from('courses').insert({ ...row, prodi: gate.prodi })
  if (error) return { error: humanDbError(error, 'Kode mata kuliah') }

  revalidatePath('/[prodi]/mata-kuliah', 'page')
  return { success: true }
}

export async function updateCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { prodi: rawProdi, ...row } = readCourseForm(formData)
  const gate = await writableProdi(rawProdi)
  if ('error' in gate) return { error: gate.error }
  if (!row.kode_mk) return { error: 'Kode MK wajib diisi.' }
  if (!Number.isFinite(row.sks) || row.sks <= 0) return { error: 'SKS harus berupa angka positif.' }
  const maxSmt = PRODI_CONFIG[gate.prodi].semesters
  if (row.smt < 1 || row.smt > maxSmt) return { error: `Semester harus antara 1 dan ${maxSmt}.` }

  const supabase = await createClient()
  const { error } = await supabase
    .from('courses')
    .update({ nama_mk: row.nama_mk, sks: row.sks, jenis_mk: row.jenis_mk, smt: row.smt, kurikulum: row.kurikulum })
    .eq('kode_mk', row.kode_mk)
    .eq('prodi', gate.prodi)
  if (error) return { error: humanDbError(error, 'Kode mata kuliah') }

  revalidatePath('/[prodi]/mata-kuliah', 'page')
  return { success: true }
}

export async function deleteCourseAction(prodi: Prodi, kodeMk: string): Promise<FormState> {
  const gate = await writableProdi(prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { error } = await supabase.from('courses').delete().eq('kode_mk', kodeMk).eq('prodi', gate.prodi)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/mata-kuliah', 'page')
  return { success: true }
}
