'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'
import { manageableProdi } from '@/lib/prodi-server'

export type FormState = { error: string } | { success: true } | null

/** Fields are "setting:<key>" (this prodi's row) or "shared:<key>" (the 'all' row). */
export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await manageableProdi(formData.get('prodi'))
  if ('error' in gate) return { error: gate.error }

  const entries = Array.from(formData.entries())
  const own = entries.filter(([k]) => k.startsWith('setting:')).map(([k, v]) => ({ key: k.slice('setting:'.length), value: String(v), prodi: gate.prodi as string }))
  const shared = entries.filter(([k]) => k.startsWith('shared:')).map(([k, v]) => ({ key: k.slice('shared:'.length), value: String(v), prodi: 'all' }))

  const supabase = await createClient()
  const results = await Promise.all(
    [...own, ...shared].map(({ key, value, prodi }) => supabase.from('settings').update({ value }).eq('key', key).eq('prodi', prodi))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: humanDbError(failed.error) }

  revalidatePath('/[prodi]/pengaturan', 'page')
  return { success: true }
}
