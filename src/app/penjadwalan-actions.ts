'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSettings, settingText } from '@/lib/settings'
import { checkScheduleClashes, type ClashSummary } from './clash-actions'
import { humanDbError } from '@/lib/db-error'

export type FormState =
  | { error: string }
  | { success: true }
  | { needsOverride: true; clashes: ClashSummary[] }
  | null

function readScheduleForm(formData: FormData) {
  const academic_year_id = formData.get('academic_year_id') as string
  const jenis_kelas = formData.get('jenis_kelas') as string
  const semester_ke = parseInt(formData.get('semester_ke') as string, 10)
  const kode_mk = formData.get('kode_mk') as string
  const kelas = (formData.get('kelas') as string)?.trim().toUpperCase()
  const hari = formData.get('hari') as string
  const jam_mulai = formData.get('jam_mulai') as string
  const jam_selesai = formData.get('jam_selesai') as string
  const room_id = (formData.get('room_id') as string) || null
  const zoom_id = ((formData.get('zoom_id') as string) || '').trim()
  const jumlah_mhs = parseInt(formData.get('jumlah_mhs') as string, 10)
  const minggu = ((formData.get('minggu') as string) || 'setiap') as 'setiap' | 'ganjil' | 'genap'
  const keterangan = ((formData.get('keterangan') as string) || '').trim()
  const dosen = formData
    .getAll('dosen')
    .map((d) => String(d).trim())
    .filter(Boolean)
  const confirmOverride = formData.get('confirm_override') === 'ya'
  const overrideReason = ((formData.get('override_reason') as string) || '').trim()

  return {
    academic_year_id,
    jenis_kelas,
    semester_ke,
    kode_mk,
    kelas,
    hari,
    jam_mulai,
    jam_selesai,
    room_id,
    zoom_id,
    jumlah_mhs: Number.isFinite(jumlah_mhs) ? jumlah_mhs : 0,
    minggu,
    keterangan,
    dosen,
    confirmOverride,
    overrideReason,
  }
}

function validateSchedule(row: ReturnType<typeof readScheduleForm>): string | null {
  if (!row.academic_year_id) return 'Pilih tahun akademik.'
  if (row.jenis_kelas !== 'reguler' && row.jenis_kelas !== 'regsus') return 'Pilih jenis kelas.'
  if (row.semester_ke < 1 || row.semester_ke > 8) return 'Semester harus antara 1 dan 8.'
  if (!row.kode_mk) return 'Pilih mata kuliah.'
  if (!row.kelas) return 'Kelas wajib diisi.'
  if (!row.hari) return 'Pilih hari (lewat Sesi atau waktu bebas).'
  if (!row.jam_mulai || !row.jam_selesai) return 'Jam mulai dan jam selesai wajib diisi.'
  if (row.jam_selesai <= row.jam_mulai) return 'Jam selesai harus setelah jam mulai.'
  return null
}

/**
 * Runs the clash check and decides whether the save may proceed. Returns
 * `null` when clear to save, or the FormState to return to the client
 * (an override prompt, or an outright block when overriding is disabled).
 */
async function guardAgainstClashes(
  row: ReturnType<typeof readScheduleForm>,
  excludeId: string | null
): Promise<{ formState: FormState } | { isOverride: boolean; overrideReason: string }> {
  const result = await checkScheduleClashes(row.academic_year_id, {
    id: excludeId ?? undefined,
    hari: row.hari,
    jam_mulai: row.jam_mulai,
    jam_selesai: row.jam_selesai,
    minggu: row.minggu,
    kelas: row.kelas,
    jenis_kelas: row.jenis_kelas,
    semester_ke: row.semester_ke,
    room_id: row.room_id,
    dosenCodes: row.dosen,
  })

  if (!result.blocking) {
    return { isOverride: false, overrideReason: '' }
  }

  if (row.confirmOverride && row.overrideReason) {
    const settings = await getSettings()
    const izinkanOverride = settingText(settings, 'izinkan_override', 'ya') === 'ya'
    if (!izinkanOverride) {
      return { formState: { error: 'Jadwal ini bentrok dan fitur terobos bentrok sedang dinonaktifkan di Pengaturan.' } }
    }
    return { isOverride: true, overrideReason: row.overrideReason }
  }

  return { formState: { needsOverride: true, clashes: result.clashes } }
}

export async function createScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const row = readScheduleForm(formData)
  const validationError = validateSchedule(row)
  if (validationError) return { error: validationError }

  const guard = await guardAgainstClashes(row, null)
  if ('formState' in guard) return guard.formState

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { dosen } = row

  const { data: inserted, error: insertError } = await supabase
    .from('schedules')
    .insert({
      academic_year_id: row.academic_year_id,
      jenis_kelas: row.jenis_kelas,
      semester_ke: row.semester_ke,
      kode_mk: row.kode_mk,
      kelas: row.kelas,
      hari: row.hari,
      jam_mulai: row.jam_mulai,
      jam_selesai: row.jam_selesai,
      room_id: row.room_id,
      zoom_id: row.zoom_id,
      jumlah_mhs: row.jumlah_mhs,
      minggu: row.minggu,
      keterangan: row.keterangan,
      is_override: guard.isOverride,
      override_reason: guard.isOverride ? guard.overrideReason : '',
      override_by: guard.isOverride ? (user?.id ?? null) : null,
    })
    .select('id')
    .single()
  if (insertError) return { error: humanDbError(insertError, 'Jadwal untuk kelas ini') }

  if (dosen.length > 0) {
    const { error: lecturerError } = await supabase
      .from('schedule_lecturers')
      .insert(dosen.map((kode_dosen, i) => ({ schedule_id: inserted.id, kode_dosen, urutan: i + 1 })))
    if (lecturerError) return { error: humanDbError(lecturerError, 'Dosen ini pada jadwal') }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateScheduleAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const row = readScheduleForm(formData)
  const validationError = validateSchedule(row)
  if (validationError) return { error: validationError }

  const guard = await guardAgainstClashes(row, id)
  if ('formState' in guard) return guard.formState

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { dosen } = row

  const { error: updateError } = await supabase
    .from('schedules')
    .update({
      academic_year_id: row.academic_year_id,
      jenis_kelas: row.jenis_kelas,
      semester_ke: row.semester_ke,
      kode_mk: row.kode_mk,
      kelas: row.kelas,
      hari: row.hari,
      jam_mulai: row.jam_mulai,
      jam_selesai: row.jam_selesai,
      room_id: row.room_id,
      zoom_id: row.zoom_id,
      jumlah_mhs: row.jumlah_mhs,
      minggu: row.minggu,
      keterangan: row.keterangan,
      is_override: guard.isOverride,
      override_reason: guard.isOverride ? guard.overrideReason : '',
      override_by: guard.isOverride ? (user?.id ?? null) : null,
    })
    .eq('id', id)
  if (updateError) return { error: humanDbError(updateError, 'Jadwal untuk kelas ini') }

  const { error: deleteError } = await supabase.from('schedule_lecturers').delete().eq('schedule_id', id)
  if (deleteError) return { error: humanDbError(deleteError) }

  if (dosen.length > 0) {
    const { error: lecturerError } = await supabase
      .from('schedule_lecturers')
      .insert(dosen.map((kode_dosen, i) => ({ schedule_id: id, kode_dosen, urutan: i + 1 })))
    if (lecturerError) return { error: humanDbError(lecturerError, 'Dosen ini pada jadwal') }
  }

  revalidatePath('/')
  return { success: true }
}

export async function deleteScheduleAction(id: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('schedules').delete().eq('id', id)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/')
  return { success: true }
}
