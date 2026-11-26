'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { aksiKanal, topikKanal } from '@/lib/penilaian/live'

/**
 * Keeps the grading page fresh while a sidang is open: any grade sent or the lock (Supabase Realtime on
 * nilai_sidang / hasil_sidang, RLS-filtered) re-renders the page on the server. The event's data is never used.
 */
export function LiveSidang({ defenseId }: { defenseId: string }) {
  const router = useRouter()
  const [putus, setPutus] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const segarkan = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 300)
    }
    const filter = `defense_id=eq.${defenseId}`
    const channel = supabase
      .channel(topikKanal(defenseId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nilai_sidang', filter }, segarkan)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hasil_sidang', filter }, segarkan)
      // Realtime can't filter DELETE events: any grade removed (Ketua's unvalidasi, hapus paksa) refreshes. They are rare.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'nilai_sidang' }, segarkan)
      .subscribe((status) => {
        const a = aksiKanal(status)
        setPutus(a.putus)
        if (a.segarkan) segarkan() // catch up on anything sent while (re)connecting
      })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [defenseId, router])

  if (!putus) return null
  return (
    <p role="status" className="m-0 mb-[1rem] p-[0.6rem] border border-[var(--kuning-garis)] bg-[var(--kuning-lembut)] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--kuning)]">
      Pembaruan otomatis terputus — muat ulang halaman untuk melihat nilai terbaru.
    </p>
  )
}
