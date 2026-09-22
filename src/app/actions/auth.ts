'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export type AuthState = {
  error?: string
  message?: string
  success?: boolean
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
      error: 'Please enter both email and password.',
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    return {
      error:
        'Supabase is not configured yet. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.',
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Specific check for rate-limiting
    if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
      return {
        error: 'Too many failed sign-in attempts. Sign-in is temporarily paused. Please wait 15 minutes and try again.',
      }
    }

    // Standard credential error per PLAN.md §3.1c
    return {
      error: "That email and password don't match. Check both and try again. After five failed attempts sign-in is paused for 15 minutes.",
    }
  }

  const destination = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
  redirect(destination)
}

export async function resetPasswordAction(email: string): Promise<AuthState> {
  if (!email || !email.includes('@')) {
    return {
      error: 'Please enter a valid email address.',
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    return {
      error: 'Supabase is not configured yet. Please configure your .env.local file.',
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
    message: 'If that email address is registered, a password reset link has been sent. Please check your inbox.',
  }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/masuk')
}
