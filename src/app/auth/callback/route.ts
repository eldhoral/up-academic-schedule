import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AKTIF_COOKIE, aktifCookieOptions } from '@/lib/sesi-aktif'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const res = NextResponse.redirect(!isLocalEnv && forwardedHost ? `https://${forwardedHost}${next}` : `${origin}${next}`)
      // A fresh session starts its idle clock here, or the proxy would sign it straight out.
      res.cookies.set(AKTIF_COOKIE, '1', aktifCookieOptions(!isLocalEnv))
      return res
    }
  }

  // Return the user to an error page or login with instructions
  return NextResponse.redirect(`${origin}/masuk?error=auth_callback_failed`)
}
