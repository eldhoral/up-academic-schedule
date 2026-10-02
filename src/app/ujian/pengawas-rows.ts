import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { normalizeName } from './exam-clash'
import { KETERANGAN_LABEL, needsRoom, type ExamRow } from './exam-types'

// Rekap Pengawas: who proctors what, grouped by person. Shared by the preview and the Excel
// builder. Pure: a dosen's name is looked up in `names`, free text is taken as typed.

export const PROGRAM_LABEL = { reguler: 'Reguler', regsus: 'Reguler Khusus' } as const

export type Assignment = {
  hari: string // 'SENIN', '' while unscheduled
  tanggal: string // 'dd/mm/yyyy'
  jam: string // '08.00-10.00'
  kode_mk: string
  nama_mk: string
  kelas: string // 'A, B' when one proctor sits the kelas together
  program: string
  ruangan: string
  keterangan: string
  counted: boolean // only exams sat in a room (offline, ujian lisan) count toward JUMLAH
}

export type PengawasGroup = {
  key: string
  nama: string
  kind: 'dosen' | 'manual' | 'cadangan' // cadangan = a fixed team name such as AKADEMIK
  jumlah: number // counted assignments
  rows: Assignment[]
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/**
 * One group per pengawas. A proctor listed on several kelas of one exam that sit together
 * (same slot and room) is one duty, shown once with the kelas joined. Dosen first, then other
 * free-text names, then the fixed teams (AKADEMIK) last; unscheduled duties after the dated ones.
 */
export function buildPengawasRekap(exams: ExamRow[], names: Map<string, string>, cadangan: Set<string>): PengawasGroup[] {
  type Duty = { sort: string; kelas: Set<string>; row: Omit<Assignment, 'kelas'> }
  const groups = new Map<string, { nama: string; kind: PengawasGroup['kind']; duties: Map<string, Duty> }>()

  for (const e of exams) {
    const jam = e.jam_mulai && e.jam_selesai ? `${e.jam_mulai.slice(0, 5).replace(':', '.')}-${e.jam_selesai.slice(0, 5).replace(':', '.')}` : ''
    const slot = `${e.tanggal ?? ''}|${jam}|${e.kode_mk}|${e.jenis_kelas}|${e.semester_ke}|${e.room_id ?? ''}`
    for (const p of e.pengawas) {
      const person =
        'kode_dosen' in p
          ? { key: `dosen:${p.kode_dosen}`, nama: names.get(p.kode_dosen) ?? p.kode_dosen, kind: 'dosen' as const }
          : { key: `nama:${normalizeName(p.nama)}`, nama: normalizeName(p.nama), kind: cadangan.has(normalizeName(p.nama)) ? ('cadangan' as const) : ('manual' as const) }
      const group = groups.get(person.key) ?? { nama: person.nama, kind: person.kind, duties: new Map<string, Duty>() }
      groups.set(person.key, group)

      const duty = group.duties.get(slot)
      if (duty) duty.kelas.add(e.kelas)
      else
        group.duties.set(slot, {
          sort: `${e.tanggal ?? '9999'} ${e.jam_mulai ?? ''} ${e.kode_mk}`,
          kelas: new Set([e.kelas]),
          row: {
            hari: e.tanggal ? hariLabel(hariFromTanggal(e.tanggal)).toUpperCase() : '',
            tanggal: e.tanggal ? dmy(e.tanggal) : '',
            jam,
            kode_mk: e.kode_mk,
            nama_mk: (e.courses?.nama_mk ?? e.kode_mk).toUpperCase(),
            program: PROGRAM_LABEL[e.jenis_kelas],
            ruangan: needsRoom(e.keterangan_ujian) ? (e.rooms?.nama ?? '') : '',
            keterangan: KETERANGAN_LABEL[e.keterangan_ujian].toUpperCase(),
            counted: needsRoom(e.keterangan_ujian),
          },
        })
    }
  }

  const rank = { dosen: 0, manual: 1, cadangan: 2 }
  return [...groups.entries()]
    .map(([key, g]): PengawasGroup => {
      const rows = [...g.duties.values()]
        .sort((a, b) => a.sort.localeCompare(b.sort))
        .map((d) => ({ ...d.row, kelas: [...d.kelas].sort().join(', ') }))
      return { key, nama: g.nama, kind: g.kind, jumlah: rows.filter((r) => r.counted).length, rows }
    })
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.nama.localeCompare(b.nama))
}
