import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/role-types'
import type { ProdiAccess } from '@/lib/prodi'

export { ROLES, ROLE_LABEL, canWrite, canManage, isDosen, type Role } from '@/lib/role-types'

/** Null means signed out, or the account somehow has no profiles row yet. A SUPERADMIN always has access 'all'; a DOSEN grades S1 only. kodeDosen is set for a DOSEN only. */
export async function loadCurrentUser(supabase: SupabaseClient): Promise<{ id: string; email: string; role: Role; prodiAccess: ProdiAccess; kodeDosen: string | null } | null> {
  // getClaims verifies the session JWT; with asymmetric signing keys it does so locally, no Auth server round trip.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return null

  const { data: profile } = await supabase.from('profiles').select('role, prodi_access, kode_dosen').eq('id', claims.sub).single()
  if (!profile) return null

  const role = profile.role as Role
  const prodiAccess: ProdiAccess = role === 'SUPERADMIN' ? 'all' : role === 'DOSEN' ? 's1' : ((profile.prodi_access as ProdiAccess) ?? 's1')
  const kodeDosen = role === 'DOSEN' ? ((profile.kode_dosen as string | null) ?? null) : null
  return { id: claims.sub, email: (claims.email as string | undefined) ?? '', role, prodiAccess, kodeDosen }
}

/** Once per request: the layout, the header and the page share one lookup. */
export const getCurrentUser = cache(async () => loadCurrentUser(await createClient()))

export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}
