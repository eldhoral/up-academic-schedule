type DbErrorLike = { message: string; code?: string; details?: string | null } | null | undefined

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

  if (code === '23505' || lower.includes('duplicate key value violates unique constraint')) {
    return entity ? `${entity} ini sudah digunakan. Pakai kode atau nama lain.` : 'Data ini sudah ada. Gunakan kode atau nama lain.'
  }
  // The dosen-lock trigger on defenses: its message is already plain Indonesian.
  if (code === 'P0001' && lower.includes('sudah dinilai')) return msg
  // Deleting a prasidang that has grades (nilai_bimbingan.defense_id is on delete restrict). Only that FK:
  // nilai_bimbingan.kode_dosen -> lecturers also names nilai_bimbingan but is a different problem.
  const fkText = `${lower} ${(error.details ?? '').toLowerCase()}`
  if (fkText.includes('nilai_bimbingan_defense_id_fkey') || (fkText.includes('nilai_bimbingan') && fkText.includes('table "defenses"'))) {
    return 'Prasidang ini sudah dinilai, sehingga tidak bisa dihapus.'
  }
  if (code === '23503' || lower.includes('violates foreign key constraint')) {
    return 'Data ini masih dipakai oleh data lain, sehingga tidak bisa dihapus atau diubah.'
  }
  if (code === '23502' || lower.includes('violates not-null constraint')) {
    return 'Ada kolom wajib yang belum diisi.'
  }
  if (code === '23514' || lower.includes('violates check constraint')) {
    return 'Nilai yang dimasukkan tidak sesuai aturan yang berlaku untuk data ini.'
  }
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
