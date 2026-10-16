export const ROLES = ['SUPERADMIN', 'SCHEDULER', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  SCHEDULER: 'Penjadwal',
  VIEWER: 'Pemantau',
}

/** Jadwal (kuliah, ujian, sidang): Penjadwal and Super Admin. */
export function canWrite(role: Role | null): boolean {
  return role === 'SUPERADMIN' || role === 'SCHEDULER'
}

/** Data master, pengaturan and pengguna: Super Admin only (RLS is_superadmin agrees). */
export function canManage(role: Role | null): boolean {
  return role === 'SUPERADMIN'
}
