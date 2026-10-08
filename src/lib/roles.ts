import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/role-types'
import type { ProdiAccess } from '@/lib/prodi'

export { ROLES, ROLE_LABEL, canWrite, type Role } from '@/lib/role-types'

/** Null means signed out, or the account somehow has no profiles row yet. A SUPERADMIN always has access 'all'. */
export async function loadCurrentUser(supabase: SupabaseClient): Promise<{ id: string; email: string; role: Role; prodiAccess: ProdiAccess } | null> {
  // getClaims verifies the session JWT; with asymmetric signing keys it does so locally, no Auth server round trip.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return null

  const { data: profile } = await supabase.from('profiles').select('role, prodi_access').eq('id', claims.sub).single()
  if (!profile) return null

  const role = profile.role as Role
  return { id: claims.sub, email: (claims.email as string | undefined) ?? '', role, prodiAccess: role === 'SUPERADMIN' ? 'all' : ((profile.prodi_access as ProdiAccess) ?? 's1') }
}

/** Once per request: the layout, the header and the page share one lookup. */
export const getCurrentUser = cache(async () => loadCurrentUser(await createClient()))

export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}
