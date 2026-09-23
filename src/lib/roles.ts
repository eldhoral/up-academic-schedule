import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/role-types'

export { ROLES, ROLE_LABEL, canWrite, type Role } from '@/lib/role-types'

/** Null means signed out, or the account somehow has no profiles row yet. */
export async function getCurrentUser(): Promise<{ id: string; email: string; role: Role } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return null

  return { id: user.id, email: user.email ?? '', role: profile.role as Role }
}

export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}
