import type { Peran } from './akses'
import { ipkSebelum, nilaiBimbingan } from './nilai'

export type DosenNilai = { nama: string; nilai: number | null; manual: boolean }
export type RekapBimbingan = {
  defenseId: string
  tanggal: string
  npm: string
  nama: string
  judul: string
  ipk: number | null
  dospem1: DosenNilai
  dospem2: DosenNilai
  bimbingan: number | null
}

type DefenseIn = {
  id: string
  tanggal: string
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  pembimbing_kode: string | null
  penguji_kode: string | null
}
type StudentIn = { npm: string; sks_sebelum: number | null; bobot_sebelum: number | null }
type NilaiIn = { defense_id: string; peran: Peran; nilai: number; sumber: 'dosen' | 'manual' }

/** One row per S1 prasidang, by tanggal then nama. Pure: the page and the Excel file are both built from it. */
export function buildRekapBimbingan(
  defenses: DefenseIn[],
  students: StudentIn[],
  nilai: NilaiIn[],
  namaDosen: (kode: string) => string,
): RekapBimbingan[] {
  const mhs = new Map(students.map((s) => [s.npm, s]))
  const skor = new Map(nilai.map((n) => [`${n.defense_id}/${n.peran}`, n]))
  return defenses
    .map((d): RekapBimbingan => {
      const dosen = (kode: string | null, peran: Peran): DosenNilai => {
        const n = skor.get(`${d.id}/${peran}`)
        return { nama: kode ? namaDosen(kode) : '—', nilai: n?.nilai ?? null, manual: n?.sumber === 'manual' }
      }
      const s = mhs.get(d.npm)
      const dospem1 = dosen(d.pembimbing_kode, 'pembimbing_1')
      const dospem2 = dosen(d.penguji_kode, 'pembimbing_2')
      return {
        defenseId: d.id,
        tanggal: d.tanggal,
        npm: d.npm,
        nama: d.nama_mahasiswa,
        judul: d.judul_skripsi,
        ipk: ipkSebelum(s?.bobot_sebelum ?? null, s?.sks_sebelum ?? null),
        dospem1,
        dospem2,
        bimbingan: nilaiBimbingan(dospem1.nilai, dospem2.nilai),
      }
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama))
}
