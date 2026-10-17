import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { PRODI_CONFIG, type Prodi } from '@/lib/prodi'

export type DefenseJenis = 'prasidang' | 'sidang'

/** "Prasidang"/"Sidang" for S1, "Seminar Proposal"/"Sidang Tesis" for S2; the stored jenis is the same. */
export const jenisLabel = (prodi: Prodi, jenis: DefenseJenis) => PRODI_CONFIG[prodi].defense[jenis]

export type DefenseContext = { prodi: Prodi; academic_year_id: string; jenis: DefenseJenis }
export type Student = { npm: string; nama: string; judul_skripsi: string }

export type DefenseRow = {
  id: string
  academic_year_id: string
  prodi: Prodi
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
  penguji_eksternal_kode: string | null // sidang: Anggota Penguji I, a dosen from the master
  penguji_eksternal: string // sidang: Anggota Penguji I typed before the dropdown; '' once a dosen is picked
  is_override: boolean
  link: string // a link to the defense material (Google Drive); '' = belum ada
}

/** Trim; '' stays '' (no link); anything that is not an http(s) URL is rejected (null). */
export function normalizeDefenseLink(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return ''
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null
}

/** Label for the public jadwal-dosen button: a material link almost always lives on Google Drive. */
export function defenseLinkLabel(url: string): string {
  const host = url.replace(/^https?:\/\//i, '').toLowerCase().split('/')[0]
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'Lihat Materi'
  return 'Buka Tautan'
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** "Sen 24 Nov" for the date strip. */
export const tanggalSingkat = (iso: string) => `${hariLabel(hariFromTanggal(iso)).slice(0, 3)} ${parseInt(iso.slice(8, 10), 10)} ${BULAN[parseInt(iso.slice(5, 7), 10) - 1]}`

export const slotLabel = (mulai: string, selesai: string) => `${mulai.replace(':', '.')}–${selesai.replace(':', '.')}`
