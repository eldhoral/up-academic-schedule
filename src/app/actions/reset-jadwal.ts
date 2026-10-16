'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentUser } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { PRODI, parseProdi, type Prodi } from '@/lib/prodi'

export type ResetKind = 'kuliah' | 'ujian' | 'sidang'
export type ResetCounts = Record<ResetKind, Record<Prodi, number>>

const TABLE: Record<ResetKind, string> = { kuliah: 'schedules', ujian: 'exams', sidang: 'defenses' }
const KINDS = Object.keys(TABLE) as ResetKind[]
const DENIED = { error: 'Hanya Super Admin yang dapat mereset jadwal.' }

async function isManager() {
  const user = await getCurrentUser()
  return !!user && canManage(user.role)
}

/** How many rows each jadwal × prodi holds in one academic year: what a reset would delete. */
export async function countJadwalAction(yearId: string): Promise<{ counts: ResetCounts } | { error: string }> {
  if (!(await isManager())) return DENIED
  const supabase = await createClient()
  const cells = KINDS.flatMap((kind) => PRODI.map((prodi) => ({ kind, prodi })))
  const results = await Promise.all(
    cells.map(({ kind, prodi }) =>
      supabase.from(TABLE[kind]).select('id', { count: 'exact', head: true }).eq('academic_year_id', yearId).eq('prodi', prodi),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: humanDbError(failed.error) }

  const counts = Object.fromEntries(KINDS.map((k) => [k, { s1: 0, s2: 0 }])) as ResetCounts
  cells.forEach(({ kind, prodi }, i) => (counts[kind][prodi] = results[i].count ?? 0))
  return { counts }
}

/** Deletes the picked jadwal × prodi of one academic year, all in one transaction (reset_jadwal). */
export async function resetJadwalAction(
  yearId: string,
  picks: { kind: ResetKind; prodi: Prodi }[],
): Promise<{ deleted: number } | { error: string }> {
  if (!(await isManager())) return DENIED
  const valid = picks.filter((p) => KINDS.includes(p.kind) && parseProdi(p.prodi))
  if (!yearId || valid.length === 0) return { error: 'Pilih tahun akademik dan minimal satu jadwal.' }
  const prodiOf = (kind: ResetKind) => valid.filter((p) => p.kind === kind).map((p) => p.prodi)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reset_jadwal', {
    p_year: yearId,
    p_kuliah: prodiOf('kuliah'),
    p_ujian: prodiOf('ujian'),
    p_sidang: prodiOf('sidang'),
  })
  if (error) return { error: humanDbError(error) }

  revalidatePath('/', 'layout')
  const deleted = data as Record<ResetKind, number>
  return { deleted: deleted.kuliah + deleted.ujian + deleted.sidang }
}
