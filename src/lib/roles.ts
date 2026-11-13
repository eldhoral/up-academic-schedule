import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isPenguji, type Role } from '@/lib/role-types'
import type { ProdiAccess } from '@/lib/prodi'
import { eksternalAktif } from '@/lib/penilaian/akses'

export { ROLES, ROLE_LABEL, canWrite, canManage, isDosen, isPenguji, type Role } from '@/lib/role-types'

/** Null means signed out, or the account somehow has no profiles row yet. A SUPERADMIN always has access 'all'; a DOSEN or EKSTERNAL grades S1 only. kodeDosen is set for those two, berlakuSampai for an EKSTERNAL only. An expired EKSTERNAL is signed out (null). */
export async function loadCurrentUser(supabase: SupabaseClient): Promise<{ id: string; email: string; role: Role; prodiAccess: ProdiAccess; kodeDosen: string | null; berlakuSampai: string | null } | null> {
  // getClaims verifies the session JWT; with asymmetric signing keys it does so locally, no Auth server round trip.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return null

  const { data: profile } = await supabase.from('profiles').select('role, prodi_access, kode_dosen, berlaku_sampai').eq('id', claims.sub).single()
  if (!profile) return null

  const role = profile.role as Role
  const berlakuSampai = role === 'EKSTERNAL' ? ((profile.berlaku_sampai as string | null) ?? null) : null
  if (role === 'EKSTERNAL' && (!berlakuSampai || !eksternalAktif(berlakuSampai))) return null

  const penguji = isPenguji(role)
  const prodiAccess: ProdiAccess = role === 'SUPERADMIN' ? 'all' : penguji ? 's1' : ((profile.prodi_access as ProdiAccess) ?? 's1')
  const kodeDosen = penguji ? ((profile.kode_dosen as string | null) ?? null) : null
  return { id: claims.sub, email: (claims.email as string | undefined) ?? '', role, prodiAccess, kodeDosen, berlakuSampai }
}

/** Once per request: the layout, the header and the page share one lookup. */
export const getCurrentUser = cache(async () => loadCurrentUser(await createClient()))

export async function getCurrentRole(): Promise<Role | null> {
  const user = await getCurrentUser()
  return user?.role ?? null
}
