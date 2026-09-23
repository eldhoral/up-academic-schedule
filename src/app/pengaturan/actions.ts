'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { humanDbError } from '@/lib/db-error'

export type FormState = { error: string } | { success: true } | null

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient()

  const entries = Array.from(formData.entries()).filter(([key]) => key.startsWith('setting:'))
  const updates = entries.map(([key, value]) => ({
    key: key.slice('setting:'.length),
    value: String(value),
  }))

  const results = await Promise.all(
    updates.map(({ key, value }) => supabase.from('settings').update({ value }).eq('key', key))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: humanDbError(failed.error) }

  revalidatePath('/pengaturan')
  return { success: true }
}
