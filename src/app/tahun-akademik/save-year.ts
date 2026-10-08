import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type YearFields = { label: string; mulai_kuliah: string | null; selesai_kuliah: string | null }
export type SaveStep = 'save' | 'activate' | 'deactivate'

/**
 * Saves one academic year so a failure never leaves the app with no active term:
 * the row is written first (new rows start inactive), then made active, and only then are
 * the other active terms switched off. A failure at the last step leaves two active terms,
 * which every reader resolves to the newest; saving again finishes the job.
 * Not in actions.ts: a 'use server' file would expose this as a callable action.
 */
export async function saveAcademicYear(
  supabase: SupabaseClient,
  input: { id: string; isNew: boolean; fields: YearFields; isActive: boolean },
): Promise<{ step: SaveStep; error: PostgrestError } | null> {
  const { id, isNew, fields, isActive } = input
  const years = () => supabase.from('academic_years')

  const saved = isNew
    ? await years().insert({ id, ...fields, is_active: false })
    : await years().update(isActive ? fields : { ...fields, is_active: false }).eq('id', id)
  if (saved.error) return { step: 'save', error: saved.error }
  if (!isActive) return null

  const activated = await years().update({ is_active: true }).eq('id', id)
  if (activated.error) return { step: 'activate', error: activated.error }

  const others = await years().update({ is_active: false }).eq('is_active', true).neq('id', id)
  if (others.error) return { step: 'deactivate', error: others.error }
  return null
}
