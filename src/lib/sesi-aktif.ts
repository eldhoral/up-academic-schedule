/**
 * Idle sign-out. A signed-in browser carries this cookie; its value is the idle limit in minutes (Pengaturan,
 * sesi_idle_menit, read at sign-in) and its Max-Age that many minutes. Activity in any tab renews it (SesiAktif).
 * The browser drops it after that many idle minutes, closed or not, by its own clock, so server/client clock skew
 * doesn't matter. The proxy signs out a session that arrives without it, with no settings read per request.
 * Not HttpOnly: the page renews it.
 */
export const AKTIF_COOKIE = 'aktif'
export const MENIT_DEFAULT = 30

/**
 * The stored setting (or cookie value) as minutes, at most 720. Below 5 or unreadable is the default: that also covers
 * the cookie's first form, value '1', still in browsers signed in before the setting existed.
 */
export function menitIdle(raw: string | null | undefined): number {
  const n = parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n >= 5 ? Math.min(720, n) : MENIT_DEFAULT
}

export const aktifCookieOptions = (menit: number, secure: boolean) =>
  ({ maxAge: menit * 60, path: '/', sameSite: 'lax', secure, httpOnly: false }) as const

/** Sign-in refused: another browser holds the account (one login per account, klaim_sesi). */
export const sedangDipakai = (menit: number) =>
  `Akun ini sedang dipakai di perangkat lain. Minta pengguna tersebut keluar terlebih dahulu, atau coba lagi setelah ${menit} menit tanpa aktivitas di perangkat itu.`
