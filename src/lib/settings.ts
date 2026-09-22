import { createClient } from '@/lib/supabase/server'

export type SettingsMap = Record<string, string>

/** Reads every setting once per request; casts happen at the call site. */
export async function getSettings(): Promise<SettingsMap> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key, value')
  const map: SettingsMap = {}
  for (const row of data ?? []) map[row.key as string] = (row.value as string) ?? ''
  return map
}

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
