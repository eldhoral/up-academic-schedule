import { createClient } from '@/lib/supabase/server'
import { romanSemester } from '@/lib/print'
import { checkAllClashes } from './kuliah/clash-actions'
import { checkAllExamClashes } from './ujian/actions'

export type ScheduleStatus = {
  summary: string
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
      summary: `${data.length} jadwal${semesters.length ? ` · smt ${semesters.map(romanSemester).join(', ')}` : ''}`,
      bentrok,
      peringatan: clashes.length - bentrok,
    }
  } catch {
    return null
  }
}

/** Same for UTS/UAS. Null when it can't be read, e.g. before the exams migration has been run. */
export async function getUjianStatus(academicYearId: string): Promise<ScheduleStatus | null> {
  try {
    const supabase = await createClient()
    const [{ data, error }, clashes] = await Promise.all([
      supabase.from('exams').select('jenis_ujian, tanggal').eq('academic_year_id', academicYearId),
      checkAllExamClashes(academicYearId),
    ])
    if (error || !data) return null

    const count = (jenis: string) => {
      const rows = data.filter((r) => r.jenis_ujian === jenis)
      return `${rows.filter((r) => r.tanggal).length}/${rows.length}`
    }
    const bentrok = clashes.filter((c) => c.policy === 'blok').length
    return {
      summary: data.length === 0 ? 'Belum ada jadwal ujian' : `UTS ${count('uts')} · UAS ${count('uas')} terjadwal`,
      bentrok,
      peringatan: clashes.length - bentrok,
    }
  } catch {
    return null
  }
}
