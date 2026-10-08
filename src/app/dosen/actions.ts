'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { canWrite, getCurrentUser } from '@/lib/roles'
import { newJadwalToken } from '../jadwal-dosen/token'

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
  if (!row.kode_dosen || !row.nama) return { error: 'Kode dosen dan nama wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase.from('lecturers').insert(row)
  if (error) return { error: humanDbError(error, 'Kode dosen') }

  revalidatePath('/dosen')
  return { success: true }
}

export async function updateLecturerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readLecturerForm(formData)
  if (!row.kode_dosen) return { error: 'Kode dosen wajib diisi.' }
  if (!row.nama) return { error: 'Nama wajib diisi.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lecturers')
    .update({ nidn: row.nidn, nama: row.nama, gelar_depan: row.gelar_depan, gelar_belakang: row.gelar_belakang })
    .eq('kode_dosen', row.kode_dosen)
  if (error) return { error: humanDbError(error, 'Kode dosen') }

  revalidatePath('/dosen')
  return { success: true }
}

export async function deleteLecturerAction(kodeDosen: string): Promise<FormState> {
  const supabase = await createClient()

  // Pengawas on an exam is a jsonb list with no foreign key, so the database won't stop this.
  // An error here (e.g. the exams table not created yet) is not a reason to block the delete.
  const { count, error: usedError } = await supabase
    .from('exams')
    .select('id', { count: 'exact', head: true })
    .contains('pengawas', [{ kode_dosen: kodeDosen }])
  if (!usedError && count) return { error: `Dosen ini masih menjadi pengawas di ${count} jadwal ujian. Ganti pengawasnya dulu.` }

  const { error } = await supabase.from('lecturers').delete().eq('kode_dosen', kodeDosen)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/dosen')
  return { success: true }
}

export type LinkState = { token: string } | { error: string }

/**
 * The lecturer's jadwal link token. Without `reset`, an existing token is returned as is (any signed-in
 * role may copy it) and a missing one is created; with `reset`, a new token replaces the old one,
 * which stops working at once. Creating and resetting are for SCHEDULER and SUPERADMIN (RLS agrees).
 */
export async function jadwalLinkAction(kodeDosen: string, reset: boolean): Promise<LinkState> {
  const supabase = await createClient()
  if (!reset) {
    const { data } = await supabase.from('lecturers').select('jadwal_token').eq('kode_dosen', kodeDosen).maybeSingle()
    if (data?.jadwal_token) return { token: data.jadwal_token as string }
  }

  const user = await getCurrentUser()
  if (!user || !canWrite(user.role)) return { error: 'Hanya Scheduler atau Superadmin yang dapat membuat atau mengganti link jadwal.' }

  const token = newJadwalToken()
  const { data, error } = await supabase.from('lecturers').update({ jadwal_token: token }).eq('kode_dosen', kodeDosen).select('kode_dosen')
  if (error) return { error: humanDbError(error) }
  if (!data?.length) return { error: 'Dosen tidak ditemukan.' }

  revalidatePath('/dosen')
  return { token }
}
