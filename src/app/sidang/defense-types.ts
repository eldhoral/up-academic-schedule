import { hariFromTanggal, hariLabel } from '@/lib/hari'

export type DefenseJenis = 'prasidang' | 'sidang'

export const JENIS_LABEL: Record<DefenseJenis, string> = { prasidang: 'Prasidang', sidang: 'Sidang' }

export type DefenseContext = { academic_year_id: string; jenis: DefenseJenis }
export type Student = { npm: string; nama: string; judul_skripsi: string }

export type DefenseRow = {
  id: string
  academic_year_id: string
  jenis: DefenseJenis
  tanggal: string // 'YYYY-MM-DD'
  jam_mulai: string // 'HH:MM'
  jam_selesai: string
  room_id: string | null // sidang
  room_nama: string | null
  kelompok: number | null // prasidang
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  pembimbing_kode: string | null // prasidang: Pembimbing Pendamping · sidang: Anggota Penguji II
  penguji_kode: string | null // prasidang: Pembahas · sidang: Ketua Sidang
  penguji_eksternal: string // sidang: Anggota Penguji I
  is_override: boolean
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "Sen 24 Nov" for the date strip. */
export const tanggalSingkat = (iso: string) => `${hariLabel(hariFromTanggal(iso)).slice(0, 3)} ${parseInt(iso.slice(8, 10), 10)} ${BULAN[parseInt(iso.slice(5, 7), 10) - 1]}`

export const slotLabel = (mulai: string, selesai: string) => `${mulai.replace(':', '.')}–${selesai.replace(':', '.')}`
