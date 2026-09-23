export const ROLES = ['SUPERADMIN', 'SCHEDULER', 'VIEWER'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  SCHEDULER: 'Penjadwal',
  VIEWER: 'Pemantau',
}

export function canWrite(role: Role | null): boolean {
  return role === 'SUPERADMIN' || role === 'SCHEDULER'
}
