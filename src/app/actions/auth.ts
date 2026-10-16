'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { humanDbError } from '@/lib/db-error'

export type AuthState = {
  error?: string
  message?: string
  success?: boolean
}

/** Best-effort: sign-in/out never fails because logging failed (e.g. service
 *  role key not configured yet), but the failure is logged so it's visible. */
async function logAuthEvent(
  action: 'LOGIN' | 'LOGOUT' | 'UPDATE',
  userId: string,
  email: string,
  newData?: Record<string, unknown>
) {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_log').insert({
      actor_id: userId,
      actor_email: email,
      action,
      table_name: 'auth',
      ...(newData && { record_id: userId, new_data: newData }),
    })
    if (error) console.error(`audit_log ${action} insert failed:`, error.message)
  } catch (err) {
    console.error(`audit_log ${action} insert failed:`, err)
  }
}

export async function signInAction(
  prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirectTo') as string) || '/'

  if (!email || !password) {
    return {
      error: 'Silakan isi email dan kata sandi.',
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    return {
      error:
        'Supabase belum dikonfigurasi. Silakan atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY pada berkas .env.local Anda.',
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Specific check for rate-limiting
    if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
      return {
        error: 'Terlalu banyak percobaan masuk yang gagal. Proses masuk ditunda sementara. Silakan tunggu 15 menit lalu coba lagi.',
      }
    }

    // Standard credential error per PLAN.md §3.1c
    return {
      error: 'Email dan kata sandi tidak cocok. Periksa kembali keduanya lalu coba lagi. Setelah lima kali gagal, proses masuk akan ditunda selama 15 menit.',
    }
  }

  if (data.user) await logAuthEvent('LOGIN', data.user.id, data.user.email ?? email)

  const destination = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
  redirect(destination)
}

export async function resetPasswordAction(email: string): Promise<AuthState> {
  if (!email || !email.includes('@')) {
    return {
      error: 'Silakan masukkan alamat email yang valid.',
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    return {
      error: 'Supabase belum dikonfigurasi. Silakan atur berkas .env.local Anda.',
    }
  }

  const headerStore = await headers()
  const origin = headerStore.get('origin') || 'http://localhost:3000'

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/auth/callback?next=/atur-kata-sandi`,
  })

  // Same confirmation regardless of whether email exists (per PLAN.md §3.1c)
  return {
    success: true,
    message: 'Jika alamat email tersebut terdaftar, tautan atur ulang kata sandi telah dikirim. Silakan periksa kotak masuk Anda.',
  }
}

/** Matches the Pengguna page's rule for a new account's first password. */
const MIN_PASSWORD = 8

export async function updatePasswordAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const password = (formData.get('password') as string) ?? ''
  const confirm = (formData.get('confirm') as string) ?? ''

  if (password.length < MIN_PASSWORD) return { error: `Kata sandi minimal ${MIN_PASSWORD} karakter.` }
  if (password !== confirm) return { error: 'Kedua kata sandi tidak sama. Ketik ulang kata sandi baru.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sesi Anda telah berakhir. Silakan masuk kembali.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === 'same_password') return { error: 'Kata sandi baru harus berbeda dari kata sandi lama.' }
    if (error.code === 'weak_password') return { error: 'Kata sandi terlalu lemah. Gunakan kombinasi huruf dan angka yang lebih panjang.' }
    if (error.code === 'reauthentication_needed') return { error: 'Demi keamanan, silakan keluar lalu masuk kembali sebelum mengganti kata sandi.' }
    return { error: humanDbError(error) }
  }

  // ponytail: audit_log's action CHECK only allows INSERT/UPDATE/DELETE/LOGIN/LOGOUT, so a
  // password change is an UPDATE on "auth"; add a PASSWORD action with a migration if it needs its own filter.
  await logAuthEvent('UPDATE', user.id, user.email ?? '', { kata_sandi: 'diganti' })
  return { success: true, message: 'Kata sandi berhasil disimpan.' }
}

export async function signOutAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) await logAuthEvent('LOGOUT', user.id, user.email ?? '')

  await supabase.auth.signOut()
  redirect('/masuk')
}
