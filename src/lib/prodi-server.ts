import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/roles'
import { canWrite } from '@/lib/role-types'
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
