export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'

export type AuditRow = {
  id: number
  at: string
  actor_id: string | null
  actor_email: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

export const TABLE_LABEL: Record<string, string> = {
  academic_years: 'Tahun Akademik',
  courses: 'Mata Kuliah',
  lecturers: 'Dosen',
  rooms: 'Ruangan',
  sessions: 'Sesi',
  schedules: 'Jadwal',
  schedule_lecturers: 'Dosen Jadwal',
  settings: 'Pengaturan',
  profiles: 'Pengguna',
  auth: 'Autentikasi',
}

export const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'Tambah',
  UPDATE: 'Ubah',
  DELETE: 'Hapus',
  LOGIN: 'Masuk',
  LOGOUT: 'Keluar',
}

export function tableLabel(name: string): string {
  return TABLE_LABEL[name] ?? name
}

/** Fields the table only churns internally — noisy in a diff, not a real change someone made. */
const IGNORED_FIELDS = new Set(['created_at', 'updated_at'])

export function changedFields(row: AuditRow): string[] {
  if (row.action === 'INSERT') return Object.keys(row.new_data ?? {}).filter((k) => !IGNORED_FIELDS.has(k))
  if (row.action === 'DELETE') return Object.keys(row.old_data ?? {}).filter((k) => !IGNORED_FIELDS.has(k))
  const oldD = row.old_data ?? {}
  const newD = row.new_data ?? {}
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)])
  return Array.from(keys).filter((k) => !IGNORED_FIELDS.has(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
}

/** Short one-line preview of what changed, for the list row. */
export function summarize(row: AuditRow): string {
  const fields = changedFields(row)
  if (fields.length === 0) return '—'
  if (row.action === 'INSERT') return fields.slice(0, 3).join(', ') + (fields.length > 3 ? `, +${fields.length - 3} lainnya` : '')
  if (row.action === 'DELETE') return `${fields.length} kolom`
  const first = fields[0]
  const oldV = formatValue(row.old_data?.[first])
  const newV = formatValue(row.new_data?.[first])
  const rest = fields.length > 1 ? ` (+${fields.length - 1} kolom lainnya)` : ''
  return `${first}: ${oldV} → ${newV}${rest}`
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') {
    if (value.startsWith('data:image')) return '(gambar)'
    return value.length > 60 ? value.slice(0, 60) + '…' : value
  }
  if (typeof value === 'boolean') return value ? 'ya' : 'tidak'
  return String(value)
}
