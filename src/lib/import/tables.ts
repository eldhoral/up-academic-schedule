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
}

function str(raw: ParsedRow, key: string): string {
  const v = raw[key]
  return v === undefined || v === null ? '' : String(v).trim()
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
    if (!kode_mk) return { reason: 'kode_mk is required.' }

    let nama_mk = str(raw, 'nama_mk')
    if (!nama_mk) return { reason: `Row for ${kode_mk}: nama_mk is required.` }

    const notes: string[] = []
    const pilihanSuffix = /\s*\(P\)\s*$/i
    const hasPSuffix = pilihanSuffix.test(nama_mk)
    if (hasPSuffix) {
      nama_mk = nama_mk.replace(pilihanSuffix, '').trim()
    }

    const sksRaw = raw['sks']
    const sks = typeof sksRaw === 'number' ? sksRaw : parseInt(str(raw, 'sks'), 10)
    if (!Number.isFinite(sks) || sks <= 0) {
      return { reason: `Row for ${kode_mk}: sks must be a positive number.` }
    }

    const smtRaw = raw['smt']
    const smt = typeof smtRaw === 'number' ? smtRaw : parseInt(str(raw, 'smt'), 10)
    if (!Number.isFinite(smt) || smt < 1 || smt > 8) {
      return { reason: `Row for ${kode_mk}: smt must be between 1 and 8.` }
    }

    let jenis_mk = str(raw, 'jenis_mk').toUpperCase()
    if (jenis_mk !== 'A' && jenis_mk !== 'B') {
      if (hasPSuffix) {
        jenis_mk = 'B'
        notes.push('jenis_mk defaulted to B from the "(P)" suffix on nama_mk.')
      } else {
        return { reason: `Row for ${kode_mk}: jenis_mk must be A or B.` }
      }
    } else if (hasPSuffix && jenis_mk !== 'B') {
      notes.push(`nama_mk carried a "(P)" suffix but jenis_mk was ${jenis_mk}; kept jenis_mk as given.`)
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
}

export const lecturersTable: ImportTableDef<LecturerRow> = {
  slug: 'lecturers',
  label: 'Dosen',
  headers: ['Kode Dosen', 'NIDN', 'Nama Dosen', 'Glr Dpn', 'Glr Blkg'],
  exampleRow: {
    'Kode Dosen': 'D001',
    NIDN: '0311106301',
    'Nama Dosen': 'Evanytha',
    'Glr Dpn': 'Dr.',
    'Glr Blkg': ', M.Si., Psikolog',
  },
  keyField: 'kode_dosen',
  equal: (a, b) =>
    a.nidn === b.nidn && a.nama === b.nama && a.gelar_depan === b.gelar_depan && a.gelar_belakang === b.gelar_belakang,
  parseRow(raw) {
    const kode_dosen = str(raw, 'Kode Dosen') || str(raw, 'kode_dosen')
    if (!kode_dosen) return { reason: 'Kode Dosen is required.' }

    const nama = str(raw, 'Nama Dosen') || str(raw, 'nama')
    if (!nama) return { reason: `Row for ${kode_dosen}: Nama Dosen is required.` }

    const notes: string[] = []

    let nidn = str(raw, 'NIDN') || str(raw, 'nidn')
    if (nidn) {
      const digitsOnly = /^\d+$/.test(nidn)
      if (digitsOnly && nidn.length < 10) {
        const padded = nidn.padStart(10, '0')
        notes.push(`NIDN left-padded from "${nidn}" to "${padded}" (leading zero restored).`)
        nidn = padded
      }
    }

    const gelar_depan = str(raw, 'Glr Dpn') || str(raw, 'gelar_depan')
    const gelar_belakang = str(raw, 'Glr Blkg') || str(raw, 'gelar_belakang')

    return {
      key: kode_dosen,
      notes,
      data: { kode_dosen, nidn, nama, gelar_depan, gelar_belakang },
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
    if (!nama) return { reason: 'nama is required.' }

    const kapRaw = raw['kapasitas']
    const kapasitasParsed = typeof kapRaw === 'number' ? kapRaw : parseInt(str(raw, 'kapasitas'), 10)
    const kapasitas = Number.isFinite(kapasitasParsed) ? kapasitasParsed : 0

    const keterangan = str(raw, 'keterangan')

    return { key: nama, notes: [], data: { nama, kapasitas, keterangan } }
  },
}

export const importTables = {
  courses: coursesTable,
  lecturers: lecturersTable,
  rooms: roomsTable,
} as const

export type ImportTableSlug = keyof typeof importTables
