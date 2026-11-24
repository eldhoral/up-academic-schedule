import { useEffect, useState } from 'react'

/**
 * Ids of rows that are new or changed between two versions of a list.
 * Lists with no id in common (another semester or year opened) light nothing up.
 */
export function barisBerubah<T extends { id: string }>(lama: T[], baru: T[]): Set<string> {
  const sebelum = new Map(lama.map((r) => [r.id, JSON.stringify(r)]))
  if (lama.length && !baru.some((r) => sebelum.has(r.id))) return new Set()
  return new Set(baru.filter((r) => sebelum.get(r.id) !== JSON.stringify(r)).map((r) => r.id))
}

/**
 * After a save, the rows that changed glow briefly (`.baris-sorot` in globals.css).
 * Call `tandaiSimpan()` when a dialog saves; the next new version of `rows` (router.refresh) is compared
 * with the previous one. The mark expires after 5s so a later filter change never lights up.
 */
export function useSorotSimpan<T extends { id: string }>(rows: T[]) {
  const [tunggu, setTunggu] = useState(false)
  const [prev, setPrev] = useState(rows)
  const [sorot, setSorot] = useState<Set<string>>(() => new Set())

  if (rows !== prev) {
    setPrev(rows)
    if (tunggu) {
      setSorot(barisBerubah(prev, rows))
      setTunggu(false)
    }
  }

  useEffect(() => {
    if (!tunggu) return
    const t = window.setTimeout(() => setTunggu(false), 5000)
    return () => window.clearTimeout(t)
  }, [tunggu])

  useEffect(() => {
    if (!sorot.size) return
    const t = window.setTimeout(() => setSorot(new Set()), 1300)
    return () => window.clearTimeout(t)
  }, [sorot])

  return { sorot, tandaiSimpan: () => setTunggu(true) }
}
