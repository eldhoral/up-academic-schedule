// The one place S1 and S2 differ. Pure: safe to import from client and server code.

export const PRODI = ['s1', 's2'] as const
export type Prodi = (typeof PRODI)[number]

export const PRODI_ACCESS = ['s1', 's2', 'all'] as const
export type ProdiAccess = (typeof PRODI_ACCESS)[number]

export type JenisKelas = 'reguler' | 'regsus'

export const PRODI_CONFIG: Record<
  Prodi,
  {
    label: string
    short: string
    semesters: number
    jenisKelas: JenisKelas[]
    defense: { section: string; prasidang: string; sidang: string; judul: string }
  }
> = {
  s1: {
    label: 'S1 Psikologi',
    short: 'S1',
    semesters: 8,
    jenisKelas: ['reguler', 'regsus'],
    defense: { section: 'Prasidang & Sidang', prasidang: 'Prasidang', sidang: 'Sidang', judul: 'Judul skripsi' },
  },
  s2: {
    label: 'S2 Psikologi Profesi',
    short: 'S2',
    semesters: 4,
    jenisKelas: ['reguler'],
    defense: { section: 'Seminar Proposal & Tesis', prasidang: 'Seminar Proposal', sidang: 'Sidang Tesis', judul: 'Judul tesis' },
  },
}

export const PRODI_ACCESS_LABEL: Record<ProdiAccess, string> = { s1: 'S1', s2: 'S2', all: 'Semua' }

export function parseProdi(v: unknown): Prodi | null {
  return (PRODI as readonly unknown[]).includes(v) ? (v as Prodi) : null
}

export const canAccessProdi = (access: ProdiAccess, p: Prodi) => access === 'all' || access === p

export const accessibleProdi = (access: ProdiAccess): Prodi[] => PRODI.filter((p) => canAccessProdi(access, p))

export const semesterList = (p: Prodi) => Array.from({ length: PRODI_CONFIG[p].semesters }, (_, i) => i + 1)

export function clampSemester(p: Prodi, raw: unknown): number {
  const n = parseInt(String(raw ?? ''), 10)
  return Math.min(PRODI_CONFIG[p].semesters, Math.max(1, Number.isFinite(n) ? n : 1))
}

/** Anything a prodi does not offer falls back to reguler, so an S2 URL with ?jenis=regsus still shows S2 reguler. */
export const parseJenisKelas = (p: Prodi, raw: unknown): JenisKelas =>
  raw === 'regsus' && PRODI_CONFIG[p].jenisKelas.includes('regsus') ? 'regsus' : 'reguler'

/** Prefix for the other prodi's side of a clash, e.g. "S1 · Psikologi Klinis"; empty for the current prodi. */
export const prodiTag = (current: Prodi, other: Prodi) => (other === current ? '' : `${PRODI_CONFIG[other].short} · `)
