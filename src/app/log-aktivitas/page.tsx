import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { LogAktivitasClient } from './LogAktivitasClient'
import type { AuditRow } from '@/lib/audit-log'

export default async function LogAktivitasPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(500)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/log-aktivitas" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <LogAktivitasClient rows={(data as AuditRow[]) ?? []} />
      </main>
    </div>
  )
}
