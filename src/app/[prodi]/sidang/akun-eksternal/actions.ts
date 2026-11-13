'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManage, getCurrentUser } from '@/lib/roles'
import { writableProdi } from '@/lib/prodi-server'
import { humanDbError } from '@/lib/db-error'
import { passwordAcak } from '@/lib/penilaian/akun-eksternal'
import { addDays } from '@/lib/week'

type Admin = ReturnType<typeof createAdminClient>

/** Only a day account is touched here, never any other login: the admin client bypasses RLS. */
async function akunEksternal(admin: Admin, userId: string): Promise<{ berlaku_sampai: string } | null> {
  const { data: akun } = await admin.from('akun_eksternal').select('user_id').eq('user_id', userId).maybeSingle()
  if (!akun) return null
  const { data: profil } = await admin.from('profiles').select('berlaku_sampai').eq('id', userId).eq('role', 'EKSTERNAL').maybeSingle()
  return profil?.berlaku_sampai ? { berlaku_sampai: profil.berlaku_sampai as string } : null
}

/** Super Admin and Penjadwal with S1 access. The new password is returned once and never stored. */
export async function buatPasswordBaruAction(userId: string): Promise<{ error: string } | { password: string }> {
  const gate = await writableProdi('s1')
  if ('error' in gate) return gate
  const me = (await getCurrentUser())!

  const admin = createAdminClient()
  if (!(await akunEksternal(admin, userId))) return { error: 'Akun penguji eksternal tidak ditemukan.' }

  const password = passwordAcak()
  const { data, error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: humanDbError(error) }

  // As in Pengguna: an UPDATE on "auth", best-effort. Never the password.
  const { error: logError } = await admin.from('audit_log').insert({
    actor_id: me.id,
    actor_email: me.email,
    action: 'UPDATE',
    table_name: 'auth',
    record_id: userId,
    new_data: { email: data.user?.email ?? null, kata_sandi: 'diatur ulang' },
  })
  if (logError) console.error('audit_log akun eksternal password insert failed:', logError.message)

  return { password }
}

/** Super Admin only: berlaku_sampai + 1..7 days. The profiles audit trigger logs the change. */
export async function perpanjangAction(userId: string, hari: number): Promise<{ error: string } | { berlakuSampai: string }> {
  const me = await getCurrentUser()
  if (!me || !canManage(me.role)) return { error: 'Hanya Super Admin yang dapat memperpanjang akun.' }
  if (!Number.isInteger(hari) || hari < 1 || hari > 7) return { error: 'Perpanjangan 1 sampai 7 hari.' }

  const admin = createAdminClient()
  const akun = await akunEksternal(admin, userId)
  if (!akun) return { error: 'Akun penguji eksternal tidak ditemukan.' }

  const berlakuSampai = addDays(akun.berlaku_sampai, hari)
  const { error } = await admin.from('profiles').update({ berlaku_sampai: berlakuSampai }).eq('id', userId).eq('role', 'EKSTERNAL')
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/sidang/akun-eksternal', 'page')
  return { berlakuSampai }
}
