import { parseAngka } from '@/lib/penilaian/nilai'
import type { ParsedRow } from './engine'

export type ParseResult<T> = { key: string; data: T; notes: string[] } | { reason: string }

export type ImportTableDef<T extends Record<string, unknown>> = {
  slug: string
  label: string
  headers: string[]
  exampleRow: Record<string, string | number>
  keyField: keyof T & string
  parseRow: (raw: ParsedRow, rowNumber: number) => ParseResult<T>
  equal: (a: T, b: T) => boolean
  /** Rows carry a prodi column: import and export are per prodi. */
  prodiScoped?: boolean
}

function str(raw: ParsedRow, key: string): string {
  const v = raw[key]
  return v === undefined || v === null ? '' : String(v).trim()
}

/** Mirrors the DB check on students.email / lecturers.email: empty or a plausible address. */
export function emailError(email: string): string | null {
  return email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? null : 'email tidak valid.'
}

/** The column exists in the file (a blank cell still counts). An absent column leaves the stored value alone. */
function has(raw: ParsedRow, ...keys: string[]): boolean {
  return keys.some((k) => raw[k] !== undefined)
}

/** Fields compare only when both sides carry them: a file without the column says nothing about it. */
const same = <T>(a: T | undefined, b: T | undefined) => a === undefined || b === undefined || a === b

/** ya/tidak/true/false/1/0 (any case); blank is false; anything else is undefined (a bad cell). */
function yesNo(raw: ParsedRow, ...keys: string[]): boolean | undefined {
  const v = keys.map((k) => str(raw, k)).find(Boolean)?.toLowerCase() ?? ''
  if (v === '' || v === 'tidak' || v === 'false' || v === '0') return false
  if (v === 'ya' || v === 'true' || v === '1') return true
  return undefined
}

/** SKS and Bobot before sidang, both optional; mirrors the DB checks (sks > 0, 0 <= bobot <= 4 x sks). */
export function sksBobot(sksRaw: string, bobotRaw: string): { sks: number | null; bobot: number | null } | { error: string } {
  let sks: number | null = null
  let bobot: number | null = null
  if (sksRaw) {
    const r = parseAngka(sksRaw, 1, 32767)
    if (!r.ok || !Number.isInteger(r.value)) return { error: 'sks_sebelum harus berupa bilangan bulat positif.' }
    sks = r.value
  }
  if (bobotRaw) {
    const r = parseAngka(bobotRaw, 0, 4 * (sks ?? 8000))
    if (!r.ok) return { error: sks ? `bobot_sebelum harus antara 0 dan ${4 * sks} (4 × SKS).` : `bobot_sebelum tidak valid. ${r.error}.` }
    bobot = r.value
  }
  return { sks, bobot }
}

// ---------------------------------------------------------------------------
// Mata Kuliah — docs/db matakuliah.xlsx columns
// ---------------------------------------------------------------------------

export type CourseRow = {
  kode_mk: string
  nama_mk: string
  sks: number
  jenis_mk: 'A' | 'B'
  smt: number
  kurikulum: string
}

export const coursesTable: ImportTableDef<CourseRow> = {
  slug: 'courses',
  prodiScoped: true,
  label: 'Mata Kuliah',
  headers: ['kode_mk', 'nama_mk', 'sks', 'jenis_mk', 'smt', 'semester', 'kurikulum'],
  exampleRow: {
    kode_mk: '15152002',
    nama_mk: 'Kewirausahaan',
    sks: 2,
    jenis_mk: 'A',
    smt: 5,
    semester: 'Gasal',
    kurikulum: '2026',
  },
  keyField: 'kode_mk',
  equal: (a, b) =>
    a.nama_mk === b.nama_mk && a.sks === b.sks && a.jenis_mk === b.jenis_mk && a.smt === b.smt && a.kurikulum === b.kurikulum,
  parseRow(raw) {
    const kode_mk = str(raw, 'kode_mk')
    if (!kode_mk) return { reason: 'kode_mk wajib diisi.' }

    let nama_mk = str(raw, 'nama_mk')
    if (!nama_mk) return { reason: `Baris ${kode_mk}: nama_mk wajib diisi.` }

    const notes: string[] = []
    const pilihanSuffix = /\s*\(P\)\s*$/i
    const hasPSuffix = pilihanSuffix.test(nama_mk)
    if (hasPSuffix) {
      nama_mk = nama_mk.replace(pilihanSuffix, '').trim()
    }

    const sksRaw = raw['sks']
    const sks = typeof sksRaw === 'number' ? sksRaw : parseInt(str(raw, 'sks'), 10)
    if (!Number.isFinite(sks) || sks <= 0) {
      return { reason: `Baris ${kode_mk}: sks harus berupa angka positif.` }
    }

    const smtRaw = raw['smt']
    const smt = typeof smtRaw === 'number' ? smtRaw : parseInt(str(raw, 'smt'), 10)
    if (!Number.isFinite(smt) || smt < 1 || smt > 8) {
      return { reason: `Baris ${kode_mk}: smt harus antara 1 dan 8.` }
    }

    let jenis_mk = str(raw, 'jenis_mk').toUpperCase()
    if (jenis_mk !== 'A' && jenis_mk !== 'B') {
      if (hasPSuffix) {
        jenis_mk = 'B'
        notes.push('jenis_mk otomatis diisi B karena akhiran "(P)" pada nama_mk.')
      } else {
        return { reason: `Baris ${kode_mk}: jenis_mk harus A atau B.` }
      }
    } else if (hasPSuffix && jenis_mk !== 'B') {
      notes.push(`nama_mk memiliki akhiran "(P)" tetapi jenis_mk adalah ${jenis_mk}; jenis_mk tetap dipakai sesuai data.`)
    }

    const kurikulum = str(raw, 'kurikulum') || '2026'

    return {
      key: kode_mk,
      notes,
      data: { kode_mk, nama_mk, sks, jenis_mk: jenis_mk as 'A' | 'B', smt, kurikulum },
    }
  },
}

// ---------------------------------------------------------------------------
// Dosen — docs/db dosen.xlsx columns: No, Kode Dosen, NIDN, Nama Dosen, Glr Dpn, Glr Blkg
// ---------------------------------------------------------------------------

export type LecturerRow = {
  kode_dosen: string
  nidn: string
  nama: string
  gelar_depan: string
  gelar_belakang: string
  email?: string // absent = the file had no such column: the stored value is left alone
  eksternal?: boolean
}

export const lecturersTable: ImportTableDef<LecturerRow> = {
  slug: 'lecturers',
  label: 'Dosen',
  headers: ['Kode Dosen', 'NIDN', 'Nama Dosen', 'Glr Dpn', 'Glr Blkg', 'Email', 'Eksternal'],
  exampleRow: {
    'Kode Dosen': 'D001',
    NIDN: '0311106301',
    'Nama Dosen': 'Evanytha',
    'Glr Dpn': 'Dr.',
    'Glr Blkg': ', M.Si., Psikolog',
    Email: 'evanytha@univ.ac.id',
    Eksternal: 'tidak',
  },
  keyField: 'kode_dosen',
  equal: (a, b) =>
    a.nidn === b.nidn &&
    a.nama === b.nama &&
    a.gelar_depan === b.gelar_depan &&
    a.gelar_belakang === b.gelar_belakang &&
    same(a.email, b.email) &&
    same(a.eksternal, b.eksternal),
  parseRow(raw) {
    const kode_dosen = str(raw, 'Kode Dosen') || str(raw, 'kode_dosen')
    if (!kode_dosen) return { reason: 'Kode Dosen wajib diisi.' }

    const nama = str(raw, 'Nama Dosen') || str(raw, 'nama')
    if (!nama) return { reason: `Baris ${kode_dosen}: Nama Dosen wajib diisi.` }

    const notes: string[] = []

    let nidn = str(raw, 'NIDN') || str(raw, 'nidn')
    if (nidn) {
      const digitsOnly = /^\d+$/.test(nidn)
      if (digitsOnly && nidn.length < 10) {
        const padded = nidn.padStart(10, '0')
        notes.push(`NIDN diberi awalan nol dari "${nidn}" menjadi "${padded}" (nol di depan dipulihkan).`)
        nidn = padded
      }
    }

    const gelar_depan = str(raw, 'Glr Dpn') || str(raw, 'gelar_depan')
    const gelar_belakang = str(raw, 'Glr Blkg') || str(raw, 'gelar_belakang')

    const email = str(raw, 'Email') || str(raw, 'email')
    const badEmail = emailError(email)
    if (badEmail) return { reason: `Baris ${kode_dosen}: ${badEmail}` }

    const eksternal = yesNo(raw, 'Eksternal', 'eksternal')
    if (eksternal === undefined) return { reason: `Baris ${kode_dosen}: Eksternal harus ya atau tidak.` }
    const optional = {
      ...(has(raw, 'Email', 'email') && { email }),
      ...(has(raw, 'Eksternal', 'eksternal') && { eksternal }),
    }

    return {
      key: kode_dosen,
      notes,
      data: { kode_dosen, nidn, nama, gelar_depan, gelar_belakang, ...optional },
    }
  },
}

/** Builds the printed display name: "Glr Dpn" + "Nama" + "Glr Blkg", per PLAN.md §3.1. */
export function lecturerDisplayName(l: { nama: string; gelar_depan: string; gelar_belakang: string }): string {
  const depan = l.gelar_depan ? `${l.gelar_depan} ` : ''
  const belakang = l.gelar_belakang.trim()
  return `${depan}${l.nama}${belakang}`.trim()
}

// ---------------------------------------------------------------------------
// Ruangan — nama, kapasitas, keterangan
// ---------------------------------------------------------------------------

export type RoomRow = {
  nama: string
  kapasitas: number
  keterangan: string
}

export const roomsTable: ImportTableDef<RoomRow> = {
  slug: 'rooms',
  label: 'Ruangan',
  headers: ['nama', 'kapasitas', 'keterangan'],
  exampleRow: { nama: '301', kapasitas: 40, keterangan: '' },
  keyField: 'nama',
  equal: (a, b) => a.kapasitas === b.kapasitas && a.keterangan === b.keterangan,
  parseRow(raw) {
    const nama = str(raw, 'nama')
    if (!nama) return { reason: 'nama wajib diisi.' }

    const kapRaw = raw['kapasitas']
    const kapasitasParsed = typeof kapRaw === 'number' ? kapRaw : parseInt(str(raw, 'kapasitas'), 10)
    const kapasitas = Number.isFinite(kapasitasParsed) ? kapasitasParsed : 0

    const keterangan = str(raw, 'keterangan')

    return { key: nama, notes: [], data: { nama, kapasitas, keterangan } }
  },
}

// ---------------------------------------------------------------------------
// Mahasiswa — npm, nama, judul_skripsi (the export's own columns, so it re-imports)
// ---------------------------------------------------------------------------

export type StudentRow = {
  npm: string
  nama: string
  judul_skripsi: string
  email?: string // the four below: absent = the file had no such column, the stored value is left alone
  sks_sebelum?: number | null
  bobot_sebelum?: number | null
  tepat_waktu?: boolean
}

export const studentsTable: ImportTableDef<StudentRow> = {
  slug: 'students',
  prodiScoped: true,
  label: 'Mahasiswa',
  headers: ['npm', 'nama', 'judul_skripsi', 'email', 'sks_sebelum', 'bobot_sebelum', 'tepat_waktu'],
  exampleRow: {
    npm: '6021210017',
    nama: 'Alfia Rizkyani',
    judul_skripsi: 'Peran Problematic Online Game Use Terhadap Kualitas Tidur',
    email: 'alfia@student.univ.ac.id',
    sks_sebelum: 139,
    bobot_sebelum: '404,57',
    tepat_waktu: 'ya',
  },
  keyField: 'npm',
  equal: (a, b) =>
    a.nama === b.nama &&
    a.judul_skripsi === b.judul_skripsi &&
    same(a.email, b.email) &&
    same(a.sks_sebelum, b.sks_sebelum) &&
    same(a.bobot_sebelum, b.bobot_sebelum) &&
    same(a.tepat_waktu, b.tepat_waktu),
  parseRow(raw) {
    const npm = str(raw, 'npm') || str(raw, 'NPM')
    if (!npm) return { reason: 'npm wajib diisi.' }
    if (!/^\d+$/.test(npm)) return { reason: `Baris ${npm}: npm hanya boleh berisi angka.` }

    const nama = str(raw, 'nama') || str(raw, 'Nama')
    if (!nama) return { reason: `Baris ${npm}: nama wajib diisi.` }

    const judul_skripsi = str(raw, 'judul_skripsi') || str(raw, 'Judul Skripsi')

    const email = str(raw, 'email') || str(raw, 'Email')
    const badEmail = emailError(email)
    if (badEmail) return { reason: `Baris ${npm}: ${badEmail}` }

    const nilai = sksBobot(str(raw, 'sks_sebelum'), str(raw, 'bobot_sebelum'))
    if ('error' in nilai) return { reason: `Baris ${npm}: ${nilai.error}` }

    const tepat_waktu = yesNo(raw, 'tepat_waktu')
    if (tepat_waktu === undefined) return { reason: `Baris ${npm}: tepat_waktu harus ya atau tidak.` }

    const optional = {
      ...(has(raw, 'email', 'Email') && { email }),
      ...(has(raw, 'sks_sebelum') && { sks_sebelum: nilai.sks }),
      ...(has(raw, 'bobot_sebelum') && { bobot_sebelum: nilai.bobot }),
      ...(has(raw, 'tepat_waktu') && { tepat_waktu }),
    }
    return { key: npm, notes: [], data: { npm, nama, judul_skripsi, ...optional } }
  },
}

export const importTables = {
  courses: coursesTable,
  lecturers: lecturersTable,
  rooms: roomsTable,
  students: studentsTable,
} as const

export type ImportTableSlug = keyof typeof importTables
