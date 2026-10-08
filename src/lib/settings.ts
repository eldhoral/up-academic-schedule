import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Prodi } from '@/lib/prodi'

export type SettingsMap = Record<string, string>

/**
 * A prodi's settings plus the shared ('all') ones; casts happen at the call site.
 * Signature images (base64, the bulk of the table) only when `withImages`: just the cetak and rekap pages print them.
 */
export async function loadSettings(supabase: SupabaseClient, prodi: Prodi, withImages: boolean): Promise<SettingsMap> {
  let query = supabase.from('settings').select('key, value').in('prodi', [prodi, 'all'])
  if (!withImages) query = query.neq('type', 'image')
  const { data } = await query
  const map: SettingsMap = {}
  for (const row of data ?? []) map[row.key as string] = (row.value as string) ?? ''
  return map
}

/** Read once per request: a page and the helpers it calls share one query. */
export const getSettings = cache(async (prodi: Prodi, withImages = false) => loadSettings(await createClient(), prodi, withImages))

export function settingInt(settings: SettingsMap, key: string, fallback: number): number {
  const parsed = parseInt(settings[key], 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function settingText(settings: SettingsMap, key: string, fallback = ''): string {
  return settings[key] ?? fallback
}

export function settingList(settings: SettingsMap, key: string): string[] {
  return (settings[key] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function settingBool(settings: SettingsMap, key: string, fallback = false): boolean {
  const v = settings[key]
  if (v === undefined) return fallback
  return v === 'ya' || v === 'true' || v === '1'
}
