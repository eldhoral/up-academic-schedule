import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/role-types'
import type { ProdiAccess } from '@/lib/prodi'

export { ROLES, ROLE_LABEL, canWrite, type Role } from '@/lib/role-types'

/** Null means signed out, or the account somehow has no profiles row yet. A SUPERADMIN always has access 'all'. */
export async function getCurrentUser(): Promise<{ id: string; email: string; role: Role; prodiAccess: ProdiAccess } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role, prodi_access').eq('id', user.id).single()
  if (!profile) return null

  const role = profile.role as Role
  return { id: user.id, email: user.email ?? '', role, prodiAccess: role === 'SUPERADMIN' ? 'all' : ((profile.prodi_access as ProdiAccess) ?? 's1') }
}

export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}
