import { createClient } from '@/lib/supabase/server'
import { romanSemester } from '@/lib/print'
import { checkAllClashes } from './kuliah/clash-actions'

export type ScheduleStatus = {
  jadwal: number
  semesters: string // "I, III, V" -- roman, like the printed sheets
  bentrok: number // blocking clashes
  peringatan: number
}

/** What the menu shows for the kuliah schedule of one academic year; null when it can't be read. */
export async function getKuliahStatus(academicYearId: string): Promise<ScheduleStatus | null> {
  try {
    const supabase = await createClient()
    const [{ data, error }, clashes] = await Promise.all([
      supabase.from('schedules').select('semester_ke').eq('academic_year_id', academicYearId),
      checkAllClashes(academicYearId),
    ])
    if (error || !data) return null

    const semesters = [...new Set(data.map((r) => r.semester_ke as number))].sort((a, b) => a - b)
    const bentrok = clashes.filter((c) => c.policy === 'blok').length
    return {
      jadwal: data.length,
      semesters: semesters.map(romanSemester).join(', '),
      bentrok,
      peringatan: clashes.length - bentrok,
    }
  } catch {
    return null
  }
}
