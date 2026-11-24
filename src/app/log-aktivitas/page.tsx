import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { LogAktivitasClient } from './LogAktivitasClient'
import { LOG_PAGE_SIZE, logSearchFilter, parseLogFilters, type AuditRow } from '@/lib/audit-log'

// Dates in the filter are Jakarta days, as the staff read them.
const WIB = '+07:00'

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default async function LogAktivitasPage(props: PageProps<'/log-aktivitas'>) {
  const rawParams = await props.searchParams
  const filters = parseLogFilters(rawParams)
  const supabase = await createClient()

  const start = (filters.page - 1) * LOG_PAGE_SIZE
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('at', { ascending: false })
    .range(start, start + LOG_PAGE_SIZE - 1)
  if (filters.table) query = query.eq('table_name', filters.table)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.from) query = query.gte('at', `${filters.from}T00:00:00${WIB}`)
  if (filters.to) query = query.lt('at', `${nextDay(filters.to)}T00:00:00${WIB}`)
  const search = logSearchFilter(filters.q)
  if (search) query = query.or(search)
  const { data, count, error } = await query
  // A page past the end (an old link, or filters that shrank the list): start over at page 1, same filters.
  if (error?.code === 'PGRST103' && filters.page > 1) {
    const params = new URLSearchParams(Object.entries(rawParams).flatMap(([k, v]) => (k === 'hal' || v === undefined ? [] : [[k, String(v)]])))
    redirect(params.size ? `/log-aktivitas?${params}` : '/log-aktivitas')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/log-aktivitas" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <LogAktivitasClient rows={(data as AuditRow[]) ?? []} total={count ?? 0} filters={filters} loadError={error ? humanDbError(error) : null} />
      </main>
    </div>
  )
}
