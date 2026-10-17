import type { AuditRow } from './audit-log'

/**
 * Helpers for the Riwayat page (per-record change history). The audit log
 * stores raw row snapshots, so values like `kode_mk`, `room_id`, or a
 * pengawas jsonb list are keys, not words. Everything here turns them back
 * into what a scheduler would actually say.
 */

export type LookupMaps = {
  courses: Map<string, string> // kode_mk → nama_mk
  lecturers: Map<string, string> // kode_dosen → nama
  rooms: Map<string, string> // id → nama
}

export const EMPTY_LOOKUPS: LookupMaps = { courses: new Map(), lecturers: new Map(), rooms: new Map() }

/** Column headings, phrased how the rest of the app names them. */
export const FIELD_LABEL: Record<string, string> = {
  academic_year_id: 'Tahun Akademik',
  jenis_kelas: 'Jenis Kelas',
  semester_ke: 'Semester',
  kode_mk: 'Mata Kuliah',
  kelas: 'Kelas',
  hari: 'Hari',
  sesi_ke: 'Sesi ke',
  jam_mulai: 'Jam Mulai',
  jam_selesai: 'Jam Selesai',
  sks: 'SKS',
  active: 'Aktif',
  room_id: 'Ruangan',
  zoom_id: 'Ruang Zoom',
  jumlah_mhs: 'Jumlah Mhs',
  minggu: 'Minggu',
  keterangan: 'Keterangan',
  is_override: 'Override',
  override_reason: 'Alasan Override',
  jenis_ujian: 'Jenis Ujian',
  pengawas: 'Pengawas',
  keterangan_ujian: 'Mode Ujian',
  link: 'Link',
  jenis: 'Jenis',
  kelompok: 'Kelompok',
  npm: 'NPM',
  nama_mahasiswa: 'Nama Mahasiswa',
  judul_skripsi: 'Judul Skripsi',
  pembimbing_kode: 'Dosen Pembimbing',
  penguji_kode: 'Dosen Penguji',
  penguji_eksternal: 'Penguji Eksternal',
  schedule_id: 'Jadwal',
  kode_dosen: 'Dosen',
  urutan: 'Urutan',
}

const lastSnapshot = (row: AuditRow): Record<string, unknown> | null =>
  row.action === 'DELETE' ? row.old_data : row.new_data

const PROGRAM_LABEL: Record<string, string> = { reguler: 'Reguler', regsus: 'Reguler Khusus' }
const EXAM_TYPE_LABEL: Record<string, string> = { offline: 'Offline', online: 'Online', take_home: 'Take Home', project: 'Project', ujian_lisan: 'Ujian Lisan' }
const defenseJenisLabel = (v: unknown) => (v === 'prasidang' ? 'Prasidang' : v === 'sidang' ? 'Sidang' : String(v))

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** One field value, resolved to a human phrase (course code + name, room name, dosen name, enum). */
export function historyValue(field: string, value: unknown, lookups: LookupMaps): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'ya' : 'tidak'

  if (field === 'kode_mk' && typeof value === 'string') {
    const nama = lookups.courses.get(value)
    return nama ? `${value} · ${nama}` : value
  }
  if (field === 'room_id' && typeof value === 'string') return lookups.rooms.get(value) ?? value
  if (['kode_dosen', 'pembimbing_kode', 'penguji_kode'].includes(field) && typeof value === 'string') {
    return lookups.lecturers.get(value) ?? value
  }
  // jsonb lists of {"kode_dosen": …} or {"nama": …} (pengawas), read by order.
  if (Array.isArray(value)) {
    const names = value.map((item) => {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>
        if (typeof o.kode_dosen === 'string') return lookups.lecturers.get(o.kode_dosen) ?? o.kode_dosen
        if (typeof o.nama === 'string') return o.nama
      }
      return JSON.stringify(item)
    })
    return names.filter(Boolean).join(', ') || '(kosong)'
  }

  switch (field) {
    case 'jenis_kelas': return PROGRAM_LABEL[String(value)] ?? String(value)
    case 'jenis_ujian': return String(value).toUpperCase()
    case 'keterangan_ujian': return EXAM_TYPE_LABEL[String(value)] ?? String(value)
    case 'jenis': return defenseJenisLabel(value)
    case 'minggu': return capitalize(String(value))
    case 'semester_ke': return `Semester ${value}`
    case 'hari': return capitalize(String(value).toLowerCase())
    default: return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }
}

/** Column heading for the label, falling back to the raw database name. */
export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field
}

/**
 * Who is this record, in one line and a few chips — read from the latest
 * snapshot in the log itself, so deleted records still resolve.
 */
export function historyIdentity(table: string, rows: AuditRow[], lookups: LookupMaps): { title: string; chips: string[] } {
  const snap = rows.map(lastSnapshot).find(Boolean) ?? {}
  const get = (k: string) => historyValue(k, snap[k], lookups)
  const mk = snap.kode_mk ? String(snap.kode_mk) : null
  const courseNama = mk ? lookups.courses.get(mk) : undefined

  if (table === 'schedules') {
    return {
      title: mk ? (courseNama ? `${mk} · ${courseNama}` : mk) : getLastRange(rows, lookups),
      chips: compact([snap.kelas ? `Kelas ${get('kelas')}` : null, get('jenis_kelas'), get('semester_ke'), get('academic_year_id')]),
    }
  }
  if (table === 'exams') {
    return {
      title: mk ? `${mk} · ${courseNama ?? ''}`.trim() : getLastRange(rows, lookups),
      chips: compact([get('jenis_ujian'), snap.kelas ? `Kelas ${get('kelas')}` : null, get('jenis_kelas'), get('semester_ke'), get('academic_year_id')]),
    }
  }
  if (table === 'defenses') {
    return {
      title: snap.nama_mahasiswa ? `${get('nama_mahasiswa')} (${get('npm')})` : getLastRange(rows, lookups),
      chips: compact([get('jenis'), get('hari') || get('tanggal'), get('academic_year_id')]),
    }
  }
  if (table === 'sessions') {
    return {
      title: `${get('hari')} · ${get('jam_mulai')}–${get('jam_selesai')}`,
      chips: compact([`Sesi ${snap.sesi_ke}`, `${snap.sks} SKS`, get('academic_year_id')]),
    }
  }
  if (table === 'schedule_lecturers') {
    return { title: lookups.lecturers.get(String(snap.kode_dosen ?? '')) ?? get('kode_dosen'), chips: compact([`Urutan ${snap.urutan}`]) }
  }
  // Every other table the log knows: fall back to the friendliest name in the snapshot.
  return {
    title: (snap.nama_mk as string) || (snap.nama as string) || (snap.email as string) || (snap.key as string) || '—',
    chips: [],
  }
}

function getLastRange(rows: AuditRow[], lookups: LookupMaps): string {
  const snap = rows.map(lastSnapshot).find(Boolean) ?? {}
  const hari = snap.hari ? historyValue('hari', snap.hari, lookups) : null
  const jam = snap.jam_mulai ? `${historyValue('jam_mulai', snap.jam_mulai, lookups)}–${historyValue('jam_selesai', snap.jam_selesai, lookups)}` : null
  return compact([hari, jam]).join(' · ') || '—'
}

/** Same shape as summarize() in audit-log, but with resolved values. */
export function historySummary(row: AuditRow, lookups: LookupMaps): string {
  const fields = changedHistoryFields(row)
  if (fields.length === 0) return '—'
  const first = fields[0]
  const phrase = (v: unknown) => historyValue(first, v, lookups)
  if (row.action === 'INSERT') {
    return fields.slice(0, 3).map((f) => `${fieldLabel(f)}: ${historyValue(f, row.new_data?.[f], lookups)}`).join(', ')
      + (fields.length > 3 ? `, +${fields.length - 3} lainnya` : '')
  }
  if (row.action === 'DELETE') {
    return `${fields.length} kolom`
  }
  return `${fieldLabel(first)}: ${phrase(row.old_data?.[first])} → ${phrase(row.new_data?.[first])} `
    + (fields.length > 1 ? `(+${fields.length - 1} kolom lainnya)` : '')
}

/** Fields that actually differ in this revision (same rule as changedFields, less timestamps). */
export function changedHistoryFields(row: AuditRow): string[] {
  const IGNORED = new Set(['created_at', 'updated_at'])
  const oldD = row.old_data ?? {}
  const newD = row.new_data ?? {}
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)])
  return Array.from(keys).filter((k) => !IGNORED.has(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
}

export function compact(parts: (string | null | undefined | false)[]): string[] {
  return parts.filter((p): p is string => !!p)
}
