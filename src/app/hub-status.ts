import { createClient } from '@/lib/supabase/server'
import { romanSemester } from '@/lib/print'
import { checkAllClashes } from './kuliah/clash-actions'
import { checkAllExamClashes } from './ujian/actions'
import { checkAllDefenseClashes } from './sidang/actions'
import { tanggalSingkat } from './sidang/defense-types'
import { FOTO_LOGIN_BUCKET, FOTO_LOGIN_FALLBACK, FOTO_LOGIN_PREFIX } from '@/lib/foto-login'

/** One menu row's status: a lead figure with its label, quieter detail, and the tally inputs. */
export type ScheduleStatus = {
  figure: string // the one number (or date) that matters, e.g. "97", "3/68", "Sab 3 Okt"
  label: string // what the figure counts, e.g. "jadwal"
  detail: string[] // quieter facts, shown after the figure
  empty: boolean // no rows yet: no tally, "clean" would mean nothing
  bentrok: number // blocking clashes
  peringatan: number // warning-tier clashes
  gaps: { n: number; label: string } | null // unfinished rows that are not clashes (no date, no examiner)
}

const blocking = (clashes: { policy: string }[]) => clashes.filter((c) => c.policy === 'blok').length

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
    return {
      figure: String(data.length),
      label: 'jadwal',
      detail: semesters.length ? [`smt ${semesters.map(romanSemester).join(', ')}`] : [],
      empty: data.length === 0,
      bentrok: blocking(clashes),
      peringatan: clashes.length - blocking(clashes),
      gaps: null,
    }
  } catch {
    return null
  }
}

/** Same for UTS/UAS. Undated exams are gaps: the schedule is not clean until they have a slot. */
export async function getUjianStatus(academicYearId: string): Promise<ScheduleStatus | null> {
  try {
    const supabase = await createClient()
    const [{ data, error }, clashes] = await Promise.all([
      supabase.from('exams').select('jenis_ujian, tanggal').eq('academic_year_id', academicYearId),
      checkAllExamClashes(academicYearId),
    ])
    if (error || !data) return null

    const of = (jenis: string) => data.filter((r) => r.jenis_ujian === jenis)
    const dated = (rows: typeof data) => rows.filter((r) => r.tanggal).length
    const [uts, uas] = [of('uts'), of('uas')]
    const lead = uts.length > 0 || uas.length === 0 ? { rows: uts, name: 'UTS' } : { rows: uas, name: 'UAS' }
    const other = lead.name === 'UTS' ? { rows: uas, name: 'UAS' } : { rows: uts, name: 'UTS' }
    const undated = data.length - dated(data)
    return {
      figure: `${dated(lead.rows)}/${lead.rows.length}`,
      label: `${lead.name} terjadwal`,
      detail: [other.rows.length ? `${other.name} ${dated(other.rows)}/${other.rows.length}` : `${other.name} belum dibuat`],
      empty: data.length === 0,
      bentrok: blocking(clashes),
      peringatan: clashes.length - blocking(clashes),
      gaps: undated > 0 ? { n: undated, label: 'belum dijadwalkan' } : null,
    }
  } catch {
    return null
  }
}

/** Same for prasidang and sidang: the next date leads; a defense missing an examiner is a gap. */
export async function getSidangStatus(academicYearId: string): Promise<ScheduleStatus | null> {
  try {
    const supabase = await createClient()
    const [{ data, error }, clashes] = await Promise.all([
      supabase.from('defenses').select('jenis, tanggal, pembimbing_kode, penguji_kode').eq('academic_year_id', academicYearId),
      checkAllDefenseClashes(academicYearId),
    ])
    if (error || !data) return null

    const today = new Date().toISOString().slice(0, 10)
    const next = data.map((r) => r.tanggal as string).filter((t) => t >= today).sort()[0]
    const counts = [`${data.filter((r) => r.jenis === 'prasidang').length} prasidang`, `${data.filter((r) => r.jenis === 'sidang').length} sidang`]
    const incomplete = data.filter((r) => !r.pembimbing_kode || !r.penguji_kode).length
    return {
      figure: next ? tanggalSingkat(next) : String(data.length),
      label: next ? 'berikutnya' : 'mahasiswa',
      detail: counts,
      empty: data.length === 0,
      bentrok: blocking(clashes),
      peringatan: clashes.length - blocking(clashes),
      gaps: incomplete > 0 ? { n: incomplete, label: 'penguji belum lengkap' } : null,
    }
  } catch {
    return null
  }
}

/** The first campus photo from Pengaturan (the same one the login page opens on), or the bundled one. */
export async function getCampusPhoto(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from(FOTO_LOGIN_BUCKET)
      .list(FOTO_LOGIN_PREFIX, { sortBy: { column: 'created_at', order: 'asc' } })
    const first = (data ?? []).find((f) => f.name && !f.name.endsWith('/'))
    if (error || !first) return FOTO_LOGIN_FALLBACK
    return supabase.storage.from(FOTO_LOGIN_BUCKET).getPublicUrl(`${FOTO_LOGIN_PREFIX}/${first.name}`).data.publicUrl
  } catch {
    return FOTO_LOGIN_FALLBACK
  }
}
