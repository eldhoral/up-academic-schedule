import type { SupabaseClient } from '@supabase/supabase-js'
import { humanDbError } from '../db-error'
import { generatePassword } from '../password'
import { addDays } from '../week'

/** Day logins sign in with a synthetic email; the login form takes the bare username. */
const DOMAIN = 'penguji.local'

/** eks-<kode, lowercase alphanumeric>-<ddmmyy>: readable, and one per (dosen, sidang date). */
export function usernameEksternal(kode: string, tanggal: string): string {
  const [y, m, d] = tanggal.split('-')
  return `eks-${kode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${d}${m}${y.slice(2)}`
}

export const passwordAcak = (len = 10, rand?: (n: number) => number): string => generatePassword(len, rand)

export const emailLogin = (input: string): string => (input.includes('@') ? input : `${input}@${DOMAIN}`)

export type AkunEksternal = { created: false } | { created: true; username: string; password: string }

/**
 * The day login for an external Anggota Penguji I on a sidang date, made once and shared by every sidang
 * that day. A new account's password is returned once and never stored. Throws a readable Error.
 * Two saves at once for the same dosen and day collide on the username (or the akun row): the loser
 * removes what it made and reports the account as existing.
 */
export async function ensureAkunEksternal(admin: SupabaseClient, kode: string, tanggal: string): Promise<AkunEksternal> {
  const berlaku = addDays(tanggal, 1)
  const ada = await admin.from('akun_eksternal').select('user_id').eq('kode_dosen', kode).eq('tanggal', tanggal).maybeSingle()
  if (ada.error) throw new Error(humanDbError(ada.error))
  if (ada.data) {
    // Only ever raises it: a Perpanjang past tanggal + 1 stays.
    const { error } = await admin.from('profiles').update({ berlaku_sampai: berlaku }).eq('id', ada.data.user_id).lt('berlaku_sampai', berlaku)
    if (error) throw new Error(humanDbError(error))
    return { created: false }
  }

  const username = usernameEksternal(kode, tanggal)
  const password = passwordAcak()
  const { data, error } = await admin.auth.admin.createUser({ email: emailLogin(username), password, email_confirm: true })
  if (error) {
    if (error.code !== 'email_exists') throw new Error(humanDbError(error))
    const { data: pemilik } = await admin.from('akun_eksternal').select('kode_dosen').eq('username', username).maybeSingle()
    if (pemilik && pemilik.kode_dosen !== kode) throw new Error(`Username ${username} sudah dipakai akun dosen lain. Hubungi Super Admin.`)
    return { created: false }
  }

  const userId = data.user.id
  // No half-made login left behind: handle_new_user made it a VIEWER, which is staff.
  const hapus = async () => {
    const { error: e } = await admin.auth.admin.deleteUser(userId)
    if (e) throw new Error(`Akun ${username} gagal dibuat dan gagal dihapus (${humanDbError(e)}). Hapus akun ini dari halaman Pengguna.`)
  }

  // Role, kode and expiry in ONE update: the DB checks tie them together.
  const { error: profilError } = await admin
    .from('profiles')
    .update({ role: 'EKSTERNAL', kode_dosen: kode, berlaku_sampai: berlaku, prodi_access: 's1' })
    .eq('id', userId)
  if (profilError) {
    await hapus()
    throw new Error(humanDbError(profilError))
  }

  const { error: akunError } = await admin.from('akun_eksternal').insert({ user_id: userId, kode_dosen: kode, tanggal, username })
  if (akunError) {
    await hapus()
    if (akunError.code === '23505') return { created: false }
    throw new Error(humanDbError(akunError))
  }
  return { created: true, username, password }
}
