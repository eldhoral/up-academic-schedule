import type { JenisKelas, Prodi } from '@/lib/prodi'

/** A row from the master `sessions` table, narrowed to what the duplicate check needs. */
export type MasterSesi = {
  jenis_kelas: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  sks: number
  sesi_ke: number
}

export type JadwalBebas = {
  prodi: Prodi
  jenis_kelas: JenisKelas
  hari: string
  jam_mulai: string
  jam_selesai: string
  sks: number
}

const jam = (s: string) => s.slice(0, 5) // DB TIME values carry seconds; the form does not.

/**
 * The master session a free-time schedule should add, or null when an equivalent one already exists.
 * SKS is part of the identity: the same hour with a different course weight is a different session.
 */
export function sesiBaruDariJadwal(ada: MasterSesi[], input: JadwalBebas) {
  if (!Number.isFinite(input.sks) || input.sks <= 0) return null
  const hari = input.hari.toUpperCase()
  if (
    ada.some(
      (s) =>
        s.jenis_kelas === input.jenis_kelas &&
        s.hari.toUpperCase() === hari &&
        jam(s.jam_mulai) === jam(input.jam_mulai) &&
        jam(s.jam_selesai) === jam(input.jam_selesai) &&
        s.sks === input.sks
    )
  ) {
    return null
  }
  const sesiKeSamaHari = ada.filter((s) => s.jenis_kelas === input.jenis_kelas && s.hari.toUpperCase() === hari)
  return {
    prodi: input.prodi,
    jenis_kelas: input.jenis_kelas,
    hari,
    jam_mulai: jam(input.jam_mulai),
    jam_selesai: jam(input.jam_selesai),
    sks: input.sks,
    sesi_ke: Math.max(0, ...sesiKeSamaHari.map((s) => s.sesi_ke)) + 1,
    active: true,
  }
}
