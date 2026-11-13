import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { halamanDosen } from '@/lib/penilaian/akses'

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
    pathname.startsWith('/jadwal-dosen/') || // the lecturer's secret link and calendar feed: no session
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

    // getClaims refreshes an expired session like getUser, but verifies the JWT locally
    // when the project uses asymmetric signing keys instead of asking the Auth server.
    const { data } = await supabase.auth.getClaims()
    const user = data?.claims ?? null

    const isMasuk = pathname === '/masuk'

    // If unauthenticated and trying to access protected route, redirect to /masuk
    if (!user && !isMasuk) return redirectToMasuk(request, pathname)

    // If authenticated and visiting /masuk, redirect to dashboard or redirectTo target
    if (user && isMasuk) {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/'
      const url = request.nextUrl.clone()
      url.pathname = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
      url.searchParams.delete('redirectTo')
      return NextResponse.redirect(url)
    }

    // A DOSEN account sees only its grading pages. Deny by default, so a new staff page, export
    // route or action POST can't reach it. RLS (is_staff) still guards the data underneath.
    // ponytail: one profiles read per staff request; move the role into a JWT claim if that shows up in latency.
    if (user && !isMasuk && !halamanDosen(pathname)) {
      const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.sub).maybeSingle()
      // Not a redirect to /masuk: a signed-in user there is sent straight back, which would loop.
      if (error) return withCookies(new NextResponse('Gagal memeriksa akun. Muat ulang halaman.', { status: 503 }), supabaseResponse)
      const blocked = tolakDosen(request, profile?.role)
      if (blocked) return withCookies(blocked, supabaseResponse)
    }
  } catch (err) {
    // Fail closed: an auth check that throws must not let the request through.
    console.error('Session update error in proxy:', err)
    if (pathname !== '/masuk') return redirectToMasuk(request, pathname)
  }

  return supabaseResponse
}

function redirectToMasuk(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = '/masuk'
  if (pathname !== '/') {
    url.searchParams.set('redirectTo', pathname)
  }
  return NextResponse.redirect(url)
}

/** A DOSEN off its own pages: a page visit goes to Penilaian Saya, anything else (a staff action's POST) gets 403. */
export function tolakDosen(request: NextRequest, role: unknown): NextResponse | null {
  if (role !== 'DOSEN' || halamanDosen(request.nextUrl.pathname)) return null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new NextResponse('Akun Dosen tidak dapat membuka halaman ini.', { status: 403 })
  }
  const url = request.nextUrl.clone()
  url.pathname = '/penilaian'
  url.search = ''
  return NextResponse.redirect(url)
}

/** Keep the refreshed session cookies on a response we build ourselves. */
function withCookies(res: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((c) => res.cookies.set(c))
  return res
}
