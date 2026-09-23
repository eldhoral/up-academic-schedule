import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client for user management (create/delete auth users, change
 * roles). Bypasses RLS entirely — only ever call this from server actions
 * that have already checked the caller's own role via getCurrentUserRole().
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY belum diatur di .env.local — ambil dari Supabase Dashboard > Settings > API (service_role secret).'
    )
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
