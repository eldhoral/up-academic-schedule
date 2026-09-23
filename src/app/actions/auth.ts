'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export type AuthState = {
  error?: string
  message?: string
  success?: boolean
}

/** Best-effort: sign-in/out never fails because logging failed (e.g. service
 *  role key not configured yet). */
async function logAuthEvent(action: 'LOGIN' | 'LOGOUT', userId: string, email: string) {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      actor_id: userId,
      actor_email: email,
      action,
      table_name: 'auth',
    })
  } catch {
    // ignore — see comment above
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
    redirectTo: `${origin}/auth/callback?next=/`,
  })

  // Same confirmation regardless of whether email exists (per PLAN.md §3.1c)
  return {
    success: true,
    message: 'Jika alamat email tersebut terdaftar, tautan atur ulang kata sandi telah dikirim. Silakan periksa kotak masuk Anda.',
  }
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
