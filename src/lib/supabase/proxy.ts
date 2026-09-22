import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const pathname = request.nextUrl.pathname

  // Don't intercept static assets or API/auth callback routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(png|jpg|jpeg|svg|css|js|ico|xlsx|pdf)$/)
  ) {
    return supabaseResponse
  }

  // If env vars are placeholder or not set, allow access to /masuk
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isMasuk = pathname === '/masuk'

    // If unauthenticated and trying to access protected route, redirect to /masuk
    if (!user && !isMasuk) {
      const url = request.nextUrl.clone()
      url.pathname = '/masuk'
      if (pathname !== '/') {
        url.searchParams.set('redirectTo', pathname)
      }
      return NextResponse.redirect(url)
    }

    // If authenticated and visiting /masuk, redirect to dashboard or redirectTo target
    if (user && isMasuk) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/'
      const url = request.nextUrl.clone()
      url.pathname = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
      url.searchParams.delete('redirectTo')
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Session update error in proxy:', err)
  }

  return supabaseResponse
}
