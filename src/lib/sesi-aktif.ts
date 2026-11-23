/**
 * Idle sign-out. A signed-in browser carries this cookie with Max-Age = 30 minutes; activity in any tab renews it
 * (SesiAktif). The browser drops it after 30 idle minutes, closed or not, by its own clock, so server/client clock skew
 * doesn't matter. The proxy signs out a session that arrives without it. Not HttpOnly: the page renews it.
 */
export const AKTIF_COOKIE = 'aktif'
export const AKTIF_DETIK = 30 * 60

export const aktifCookieOptions = (secure: boolean) =>
  ({ maxAge: AKTIF_DETIK, path: '/', sameSite: 'lax', secure, httpOnly: false }) as const
