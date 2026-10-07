import { findSlotClashes, timeOverlapMinutes } from '@/lib/clash'
import type { Prodi } from '@/lib/prodi'
import { hariFromTanggal } from '@/lib/hari'
import { normalizeName } from '../ujian/exam-clash'
import type { DefenseJenis } from './defense-types'

export type DefenseClashInput = {
  id: string
  prodi: Prodi
  jenis: DefenseJenis
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  room_id: string | null
  kelompok: number | null
  npm: string
  nama_mahasiswa: string
  pembimbing_kode: string | null
  penguji_kode: string | null
  penguji_eksternal: string
}

export type DefenseClashType = 'dosen' | 'eksternal' | 'ruangan'

export type DefenseClash = { type: DefenseClashType; a: DefenseClashInput; b: DefenseClashInput; overlapMinutes: number; detail: string }

/** What a defense occupies: its two dosen, the external examiner, and its room or breakout group. */
export function defenseKeys(d: DefenseClashInput): string[] {
  const keys = [d.pembimbing_kode, d.penguji_kode].filter((k): k is string => !!k).map((k) => `dosen:${k}`)
  if (d.penguji_eksternal.trim()) keys.push(`nama:${normalizeName(d.penguji_eksternal)}`)
  if (d.jenis === 'sidang' && d.room_id) keys.push(`ruang:${d.room_id}`)
  // Each prodi has its own Zoom meeting, so kelompok 1 of S1 and of S2 are different breakout rooms.
  if (d.jenis === 'prasidang' && d.kelompok !== null) keys.push(`kelompok:${d.prodi}:${d.kelompok}`)
  return keys
}

/** Clashes among defenses on a date, prasidang and sidang together (a dosen cannot be in both). */
export function findDefenseClashes(rows: DefenseClashInput[], names: Map<string, string>, roomNames: Map<string, string>): DefenseClash[] {
  return findSlotClashes(rows.map((r) => ({ ...r, keys: defenseKeys(r) }))).map(({ a, b, key, overlapMinutes }) => {
    const prefix = key.slice(0, key.indexOf(':'))
    const id = key.slice(key.indexOf(':') + 1)
    if (prefix === 'ruang') return { type: 'ruangan' as const, a, b, overlapMinutes, detail: roomNames.get(id) ?? '' }
    if (prefix === 'kelompok') return { type: 'ruangan' as const, a, b, overlapMinutes, detail: `Kelompok ${id.slice(id.indexOf(':') + 1)}` }
    if (prefix === 'nama') return { type: 'eksternal' as const, a, b, overlapMinutes, detail: id }
    return { type: 'dosen' as const, a, b, overlapMinutes, detail: names.get(id) ?? id }
  })
}

export type TeachingSlot = { prodi: Prodi; hari: string; jam_mulai: string; jam_selesai: string; nama_mk: string; kelas: string; dosenCodes: string[] }

export type TeachingOverlap = { defense: DefenseClashInput; kode_dosen: string; teaching: TeachingSlot; overlapMinutes: number }

/**
 * A dosen who teaches at the hour of a defense they sit on. Kuliah repeats weekly, so a date maps to its
 * hari; the alternating-week flag is ignored on purpose (it may collide), which is why callers show this
 * as a warning, never a block.
 */
export function findTeachingOverlaps(defenses: DefenseClashInput[], teaching: TeachingSlot[]): TeachingOverlap[] {
  const out: TeachingOverlap[] = []
  for (const d of defenses) {
    const hari = hariFromTanggal(d.tanggal)
    for (const t of teaching) {
      if (t.hari !== hari) continue
      const overlapMinutes = timeOverlapMinutes(d.jam_mulai, d.jam_selesai, t.jam_mulai, t.jam_selesai)
      if (overlapMinutes <= 0) continue
      for (const kode of new Set([d.pembimbing_kode, d.penguji_kode])) {
        if (kode && t.dosenCodes.includes(kode)) out.push({ defense: d, kode_dosen: kode, teaching: t, overlapMinutes })
      }
    }
  }
  return out
}
