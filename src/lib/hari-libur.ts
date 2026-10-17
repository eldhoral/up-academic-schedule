// Hari libur: faculty-wide dates with no classes. Small enough to live whole in one file:
// the DB fetch in Alice's words, and the pure helpers every consumer uses.

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type HariLibur = { tanggal: string; label: string }

export async function fetchHariLibur(supabase: SupabaseClient): Promise<{ libur: HariLibur[]; error: PostgrestError | null }> {
  // The error travels with the value: a silently-empty list would put kuliah back
  // on holiday dates, so every caller decides what a failure means for its page.
  const { data, error } = await supabase.from('holidays').select('tanggal, label').order('tanggal')
  return { libur: (data as HariLibur[] | null) ?? [], error }
}

/** The one holiday on a tanggal, if any (dates are unique in the DB). */
export function liburOn(libur: HariLibur[], tanggal: string): HariLibur | null {
  return libur.find((h) => h.tanggal === tanggal) ?? null
}

/** Dates as a set, for the skip filters on kuliah expansion. */
export function liburSet(libur: HariLibur[]): Set<string> {
  return new Set(libur.map((h) => h.tanggal))
}
