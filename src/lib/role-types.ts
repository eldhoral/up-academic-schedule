export const ROLES = ['SUPERADMIN', 'SCHEDULER', 'VIEWER', 'DOSEN'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  SCHEDULER: 'Penjadwal',
  VIEWER: 'Pemantau',
  DOSEN: 'Dosen',
}

/** Jadwal (kuliah, ujian, sidang): Penjadwal and Super Admin. */
export function canWrite(role: Role | null): boolean {
  return role === 'SUPERADMIN' || role === 'SCHEDULER'
}

/** Data master, pengaturan and pengguna: Super Admin only (RLS is_superadmin agrees). */
export function canManage(role: Role | null): boolean {
  return role === 'SUPERADMIN'
}

/** A dosen pembimbing's own account: grades its students, sees no staff data (RLS is_staff agrees). */
export function isDosen(role: Role | null): boolean {
  return role === 'DOSEN'
}
