/**
 * Pengaturan is split into pages, one per area. `groups` are settings."group" values shown on the page
 * (in this order); slug '' is /pengaturan itself. Penilaian (S1, Super Admin) is its own page, not here.
 */
export type BagianPengaturan = { slug: string; label: string; groups: string[]; fotoLogin?: boolean }

export const BAGIAN_PENGATURAN: BagianPengaturan[] = [
  { slug: '', label: 'Jadwal & Bentrok', groups: ['waktu', 'kelas', 'bentrok'] },
  { slug: 'cetak', label: 'Cetak & Tanda Tangan', groups: ['cetak', 'tanda_tangan'] },
  { slug: 'surat', label: 'Surat Penugasan', groups: ['surat'] },
  { slug: 'ujian', label: 'Jadwal Ujian', groups: ['ujian'] },
  { slug: 'sidang', label: 'Jadwal Sidang', groups: ['sidang', 'email'] },
  { slug: 'foto-login', label: 'Foto Login', groups: [], fotoLogin: true },
  { slug: 'sesi', label: 'Sesi Login', groups: ['sesi'] },
]

/** '/pengaturan' or '/pengaturan/<slug>', prodi-less like the nav tabs. */
export const pengaturanHref = (slug: string) => (slug ? `/pengaturan/${slug}` : '/pengaturan')
