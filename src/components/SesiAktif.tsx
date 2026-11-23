'use client'

import { useEffect } from 'react'
import { AKTIF_COOKIE, AKTIF_DETIK } from '@/lib/sesi-aktif'

const ada = () => document.cookie.split('; ').some((c) => c.startsWith(`${AKTIF_COOKIE}=`))

/**
 * Renews the idle cookie on activity, at most once a minute (so the real limit is 29–30 minutes). Once it has expired,
 * the page reloads and the proxy signs the session out (a public page just reloads). Inert when the cookie was absent
 * on load: nobody signed in.
 */
export function SesiAktif() {
  useEffect(() => {
    if (!ada()) return
    let terakhir = 0
    const habis = () => {
      if (ada()) return false
      window.location.reload()
      return true
    }
    const perbarui = () => {
      // Activity after expiry must not bring the cookie back.
      if (habis() || Date.now() - terakhir < 60_000) return
      terakhir = Date.now()
      document.cookie = `${AKTIF_COOKIE}=1; Max-Age=${AKTIF_DETIK}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
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
