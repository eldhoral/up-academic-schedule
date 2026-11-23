import { PESAN_GERBANG } from '@/lib/penilaian/prasidang'

type DbErrorLike = { message: string; code?: string; details?: string | null } | null | undefined

/**
 * Messages our own triggers raise in plain Indonesian (sidang gate, berita acara and bimbingan locks).
 * Exact strings only: anything else from the DB stays hidden behind generic wording.
 */
const PESAN_DB = new Set<string>([
  ...Object.values(PESAN_GERBANG),
  'Dosen Pembimbing untuk peran ini belum diisi di Data Mahasiswa.',
  'Nilai bimbingan hanya untuk sidang S1.',
  'Mahasiswa tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Tanggal tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Dosen pembimbing tidak dapat diubah: prasidang ini sudah diisi berita acaranya.',
  'Dosen pembimbing tidak dapat diubah: nilai bimbingan sudah dikirim.',
  'Dosen eksternal tidak dapat menjadi Dosen Pembimbing.',
  'NPM tidak cocok.',
  'Prasidang tidak ditemukan.',
  'Sidang tidak ditemukan.',
])

/** A dosen that can't be deleted, by the table that still references it (on delete restrict). */
const NILAI_DOSEN = 'Dosen ini sudah mengisi nilai atau berita acara, sehingga tidak bisa dihapus.'
const DOSEN_DIPAKAI: Record<string, string> = {
  students: 'Dosen ini masih menjadi Dosen Pembimbing mahasiswa di Data Mahasiswa. Ganti Dosen Pembimbing mahasiswa tersebut terlebih dahulu.',
  defenses: 'Dosen ini masih tercantum di jadwal prasidang/sidang. Ganti dosen atau hapus jadwal tersebut terlebih dahulu.',
  profiles: 'Dosen ini masih memiliki akun pengguna. Hapus akunnya di halaman Pengguna terlebih dahulu.',
  akun_eksternal: 'Dosen ini masih memiliki akun penguji eksternal. Hapus akunnya di halaman Pengguna terlebih dahulu.',
  nilai_bimbingan: NILAI_DOSEN,
  nilai_sidang: NILAI_DOSEN,
  berita_acara_prasidang: NILAI_DOSEN,
}

/**
 * Turns a raw Postgres/Supabase error into wording a non-developer can act
 * on. `entity` names the thing that collided/is missing, e.g. "Kode mata
 * kuliah" — falls back to generic phrasing when omitted.
 */
export function humanDbError(error: DbErrorLike, entity?: string): string {
  if (!error) return ''
  const code = error.code
  const msg = error.message ?? ''
  const lower = msg.toLowerCase()

  if ((code === '23514' || code === 'P0001') && PESAN_DB.has(msg)) return msg
  if (code === '23505' || lower.includes('duplicate key value violates unique constraint')) {
    return entity ? `${entity} ini sudah digunakan. Pakai kode atau nama lain.` : 'Data ini sudah ada. Gunakan kode atau nama lain.'
  }
  // The dosen-lock trigger on defenses: its message is already plain Indonesian.
  if (code === 'P0001' && lower.includes('sudah dinilai')) return msg
  // Deleting a sidang that has grades (nilai_bimbingan / nilai_sidang / hasil_sidang -> defenses, on delete restrict).
  // Constraint names only: nilai_bimbingan.kode_dosen -> lecturers also names the table but is a different problem.
  const fkText = `${lower} ${(error.details ?? '').toLowerCase()}`
  if (fkText.includes('berita_acara_prasidang_defense_id_fkey')) return 'Prasidang ini sudah diisi berita acaranya, sehingga tidak bisa dihapus.'
  if (fkText.includes('nilai_bimbingan_defense_id_fkey') || fkText.includes('nilai_sidang_defense_id_fkey') || fkText.includes('hasil_sidang_defense_id_fkey')) {
    return 'Sidang ini sudah dinilai, sehingga tidak bisa dihapus.'
  }
  if (code === '23503' || lower.includes('violates foreign key constraint')) {
    // Deleting a dosen: name what still holds it, by the referencing table.
    const pemakai = /^update or delete on table "lecturers" .* on table "(\w+)"/.exec(lower)?.[1]
    if (pemakai && pemakai in DOSEN_DIPAKAI) return DOSEN_DIPAKAI[pemakai]
    return 'Data ini masih dipakai oleh data lain, sehingga tidak bisa dihapus atau diubah.'
  }
  if (code === '23502' || lower.includes('violates not-null constraint')) {
    return 'Ada kolom wajib yang belum diisi.'
  }
  // hasil_sidang trigger: the yudisium pair is not in the (frozen) pilihan list.
  if (code === '23514' && lower.includes('yudisium tidak ada dalam pilihan')) return 'Pilihan yudisium tidak valid. Muat ulang halaman.'
  if (code === '23514' || lower.includes('violates check constraint')) {
    return 'Nilai yang dimasukkan tidak sesuai aturan yang berlaku untuk data ini.'
  }
  // kunci_sidang race: another request locked this sidang first.
  if (code === '42501' && lower.includes('nilai sidang sudah dikunci')) return 'Nilai sidang ini sudah dikunci. Muat ulang halaman.'
  if (code === '42501' || lower.includes('permission denied') || lower.includes('row-level security')) {
    return 'Anda tidak memiliki izin untuk melakukan aksi ini.'
  }
  if (lower.includes('already been registered') || lower.includes('already registered')) {
    return 'Email ini sudah terdaftar.'
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.'
  }

  // Not a recognized shape — still hide raw SQL/driver text from the user.
  return 'Terjadi kesalahan saat menyimpan data. Silakan coba lagi.'
}
