'use client'

import { useEffect } from 'react'
import { AKTIF_COOKIE, menitIdle } from '@/lib/sesi-aktif'

/** The cookie's value (the idle limit in minutes), or null once it has expired. */
const nilai = () => document.cookie.split('; ').find((c) => c.startsWith(`${AKTIF_COOKIE}=`))?.slice(AKTIF_COOKIE.length + 1) ?? null

/**
 * Renews the idle cookie on activity, and pings /api/sesi (one login per account), at most once a minute (so the real limit is up to a minute short). Once it has expired,
 * the page reloads and the proxy signs the session out (a public page just reloads). Inert when the cookie was absent
 * on load: nobody signed in.
 */
export function SesiAktif() {
  useEffect(() => {
    if (nilai() === null) return
    let terakhir = 0
    const habis = () => {
      if (nilai() !== null) return false
      window.location.reload()
      return true
    }
    const perbarui = () => {
      // Activity after expiry must not bring the cookie back.
      if (habis() || Date.now() - terakhir < 60_000) return
      terakhir = Date.now()
      const menit = menitIdle(nilai())
      document.cookie = `${AKTIF_COOKIE}=${menit}; Max-Age=${menit * 60}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
      // Tells the server this browser is still active, so the account stays held against a second login.
      void fetch('/api/sesi', { method: 'POST', keepalive: true }).catch(() => {})
    }
    const cek = () => void habis()
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'] as const
    events.forEach((e) => window.addEventListener(e, perbarui, { passive: true }))
    document.addEventListener('visibilitychange', cek)
    const id = window.setInterval(cek, 30_000)
    perbarui()
    return () => {
      events.forEach((e) => window.removeEventListener(e, perbarui))
      document.removeEventListener('visibilitychange', cek)
      window.clearInterval(id)
    }
  }, [])
  return null
}
