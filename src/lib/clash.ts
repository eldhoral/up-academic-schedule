export type Minggu = 'setiap' | 'ganjil' | 'genap'

/** setiap collides with everything; ganjil/genap collide with setiap and themselves, never with each other. */
export function weeksCollide(a: Minggu, b: Minggu): boolean {
  return a === 'setiap' || b === 'setiap' || a === b
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

export function timeOverlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = Math.max(toMinutes(aStart), toMinutes(bStart))
  const end = Math.min(toMinutes(aEnd), toMinutes(bEnd))
  return Math.max(0, end - start)
}

export type ScheduleCandidate = {
  id?: string // excluded from its own clash check when editing
  hari: string
  jam_mulai: string
  jam_selesai: string
  minggu: Minggu
  kelas: string
  jenis_kelas: string
  semester_ke: number
  room_id: string | null
  dosenCodes: string[]
}

export type ExistingScheduleForClash = {
  id: string
  kode_mk: string
  nama_mk: string
  kelas: string
  jenis_kelas: string
  semester_ke: number
  hari: string
  jam_mulai: string
  jam_selesai: string
  minggu: Minggu
  room_id: string | null
  room_nama: string | null
  dosenCodes: string[]
  dosenNames: string[]
}

export type ClashType = 'dosen' | 'kelas' | 'ruangan'

export type Clash = {
  type: ClashType
  with: ExistingScheduleForClash
  overlapMinutes: number
  detail: string
}

/**
 * The single overlap predicate the whole app exists for. Same lecturer, same
 * kelas, or same room at an overlapping time on the same hari — with the
 * week-parity clause so alternating (A)/(B) slots don't false-positive.
 */
export function findClashes(candidate: ScheduleCandidate, existing: ExistingScheduleForClash[]): Clash[] {
  const clashes: Clash[] = []

  for (const row of existing) {
    if (candidate.id && row.id === candidate.id) continue
    if (row.hari !== candidate.hari) continue
    if (!weeksCollide(row.minggu, candidate.minggu)) continue

    const overlapMinutes = timeOverlapMinutes(candidate.jam_mulai, candidate.jam_selesai, row.jam_mulai, row.jam_selesai)
    if (overlapMinutes <= 0) continue

    const sharedDosen = row.dosenCodes.filter((d) => candidate.dosenCodes.includes(d))
    if (sharedDosen.length > 0) {
      const names = row.dosenCodes
        .map((code, i) => (sharedDosen.includes(code) ? row.dosenNames[i] : null))
        .filter((n): n is string => !!n)
      clashes.push({ type: 'dosen', with: row, overlapMinutes, detail: names.join(', ') })
    }

    if (row.kelas === candidate.kelas && row.jenis_kelas === candidate.jenis_kelas && row.semester_ke === candidate.semester_ke) {
      clashes.push({ type: 'kelas', with: row, overlapMinutes, detail: `Kelas ${row.kelas}` })
    }

    if (candidate.room_id && row.room_id && row.room_id === candidate.room_id) {
      clashes.push({ type: 'ruangan', with: row, overlapMinutes, detail: row.room_nama ?? '' })
    }
  }

  return clashes
}

export type ClashPairing = {
  type: ClashType
  a: ExistingScheduleForClash
  b: ExistingScheduleForClash
  overlapMinutes: number
  detail: string
}

/**
 * All-pairs scan across a set of already-saved schedules — the standing
 * findings-bar view, as opposed to findClashes' one-candidate-vs-many check
 * used while editing a single row. O(n^2) over ~100 rows; fine at this size.
 */
export function findAllClashes(existing: ExistingScheduleForClash[]): ClashPairing[] {
  const pairings: ClashPairing[] = []
  for (let i = 0; i < existing.length; i++) {
    const a = existing[i]
    const candidate: ScheduleCandidate = {
      id: a.id,
      hari: a.hari,
      jam_mulai: a.jam_mulai,
      jam_selesai: a.jam_selesai,
      minggu: a.minggu,
      kelas: a.kelas,
      jenis_kelas: a.jenis_kelas,
      semester_ke: a.semester_ke,
      room_id: a.room_id,
      dosenCodes: a.dosenCodes,
    }
    for (const clash of findClashes(candidate, existing.slice(i + 1))) {
      pairings.push({ type: clash.type, a, b: clash.with, overlapMinutes: clash.overlapMinutes, detail: clash.detail })
    }
  }
  return pairings
}
