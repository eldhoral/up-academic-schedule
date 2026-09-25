import { createClient } from '@/lib/supabase/server'
import type { ScheduleRow } from './penjadwalan-types'

const SCHEDULE_SELECT =
  '*, courses(nama_mk, sks), rooms(nama), schedule_lecturers(urutan, lecturers(kode_dosen, nama, gelar_depan, gelar_belakang))'

export async function fetchSchedulesForContext(context: {
  academic_year_id: string
  jenis_kelas: string
  semester_ke: number | 'all'
}): Promise<ScheduleRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .eq('academic_year_id', context.academic_year_id)
    .eq('jenis_kelas', context.jenis_kelas)
  if (context.semester_ke !== 'all') query = query.eq('semester_ke', context.semester_ke)
  const { data } = await query
  return (data as unknown as ScheduleRow[]) ?? []
}

export async function fetchSchedulesForYear(academicYearId: string): Promise<ScheduleRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('schedules').select(SCHEDULE_SELECT).eq('academic_year_id', academicYearId)
  return (data as unknown as ScheduleRow[]) ?? []
}
