import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/roles'
import { canManage, canWrite } from '@/lib/role-types'
import { canAccessProdi, parseProdi, PRODI_CONFIG, type Prodi } from '@/lib/prodi'

/** The [prodi] route segment. The layout has already checked access; this only narrows the type. */
export async function prodiParam(params: Promise<{ prodi: string }>): Promise<Prodi> {
  const prodi = parseProdi((await params).prodi)
  if (!prodi) notFound()
  return prodi
}

/**
 * First line of every write action. RLS (can_write_prodi) enforces the same rule; this turns
 * what would be a silent 0-row update into a readable error.
 */
export async function writableProdi(raw: unknown): Promise<{ prodi: Prodi } | { error: string }> {
  const prodi = parseProdi(raw)
  if (!prodi) return { error: 'Prodi tidak dikenali.' }
  const user = await getCurrentUser()
  if (!user || !canWrite(user.role) || !canAccessProdi(user.prodiAccess, prodi)) {
    return { error: `Akun ini tidak dapat mengubah data ${PRODI_CONFIG[prodi].label}.` }
  }
  return { prodi }
}

/** First line of every data master / pengaturan write. RLS (is_superadmin) enforces the same rule. */
export async function managerOnly(): Promise<{ error: string } | null> {
  const user = await getCurrentUser()
  return user && canManage(user.role) ? null : { error: 'Data master dan pengaturan hanya dapat diubah Super Admin.' }
}

/** writableProdi for data master and pengaturan: Super Admin, who always has every prodi. */
export async function manageableProdi(raw: unknown): Promise<{ prodi: Prodi } | { error: string }> {
  const prodi = parseProdi(raw)
  if (!prodi) return { error: 'Prodi tidak dikenali.' }
  return (await managerOnly()) ?? { prodi }
}
