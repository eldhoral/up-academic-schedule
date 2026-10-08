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
  students: 'Mahasiswa',
  sessions: 'Sesi',
  schedules: 'Jadwal',
  schedule_lecturers: 'Dosen Jadwal',
  exams: 'Jadwal Ujian',
  defenses: 'Jadwal Sidang',
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

export const LOG_PAGE_SIZE = 50

export type LogFilters = { page: number; table: string | null; action: AuditAction | null; q: string; from: string | null; to: string | null }

type Params = Record<string, string | string[] | undefined>

/** The Log Aktivitas filters, read from the URL: anything unknown falls back to "all". */
export function parseLogFilters(params: Params): LogFilters {
  const get = (k: string) => {
    const v = params[k]
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
  }
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const page = parseInt(get('hal'), 10)
  const table = get('tabel')
  const action = get('aksi')
  return {
    page: page >= 1 ? page : 1,
    table: Object.hasOwn(TABLE_LABEL, table) ? table : null,
    action: Object.hasOwn(ACTION_LABEL, action) ? (action as AuditAction) : null,
    q: get('q'),
    from: date(get('dari')),
    to: date(get('sampai')),
  }
}

/** PostgREST or() filter for the email / record-id search; only email and id characters survive, so no comma or paren can add a condition. */
export function logSearchFilter(q: string): string | null {
  const term = q.replace(/[^\w@.-]/g, '')
  return term ? `actor_email.ilike.*${term}*,record_id.ilike.*${term}*` : null
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
    return value
  }
  if (typeof value === 'boolean') return value ? 'ya' : 'tidak'
  if (typeof value === 'object') return JSON.stringify(value) // jsonb, e.g. a pengawas list
  return String(value)
}
