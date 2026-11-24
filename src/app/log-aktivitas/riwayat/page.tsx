import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { ACTION_LABEL, TABLE_LABEL, tableLabel, type AuditAction, type AuditRow } from '@/lib/audit-log'
import {
  changedHistoryFields,
  EMPTY_LOOKUPS,
  fieldLabel,
  historyIdentity,
  historyValue,
  type LookupMaps,
} from '@/lib/audit-history'

// Like the rest of the log, one page holds a bounded slice; a single record
// rarely has more revisions than this, and the banner says so if it does.
const HISTORY_LIMIT = 200

const ACTION_BADGE: Record<AuditAction, string> = {
  INSERT: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]',
  UPDATE: 'bg-[var(--biru-lembut)] text-[var(--biru)]',
  DELETE: 'bg-[var(--merah-lembut)] text-[var(--merah)]',
  LOGIN: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]',
  LOGOUT: 'bg-[var(--cekung)] text-[var(--tinta-3)]',
}

const ACTION_DOT: Record<AuditAction, string> = {
  INSERT: 'bg-[var(--hijau)]',
  UPDATE: 'bg-[var(--biru)]',
  DELETE: 'bg-[var(--merah)]',
  LOGIN: 'bg-[var(--hijau)]',
  LOGOUT: 'bg-[var(--garis-kuat)]',
}

/** For a birth/death entry the record is the change: every column with a real value, no timestamps. */
const IMMUTABLE_SKIPS = new Set(['created_at', 'updated_at'])

export default async function RiwayatPage(props: PageProps<'/log-aktivitas/riwayat'>) {
  const rawParams = await props.searchParams
  const asStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? ''
  const tabel = asStr(rawParams.tabel)
  const id = asStr(rawParams.id)
  // The riwayat links from LogAktivitasClient only ever hit known tables, but the URL is user input.
  if (!id || !/^[A-Za-z0-9_.:-]+$/.test(id) || !Object.hasOwn(TABLE_LABEL, tabel)) redirect('/log-aktivitas')

  const supabase = await createClient()
  // Lookups so diff values read as words, not keys. Rooms are fetched
  // unfiltered: a room retired from the master still has to carry its name.
  const [logQuery, courses, lecturers, rooms] = await Promise.all([
    supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('table_name', tabel)
      .eq('record_id', id)
      .order('at', { ascending: false })
      .range(0, HISTORY_LIMIT - 1),
    supabase.from('courses').select('kode_mk, nama_mk'),
    supabase.from('lecturers').select('kode_dosen, nama'),
    supabase.from('rooms').select('id, nama'),
  ])

  const rows = (logQuery.data as AuditRow[]) ?? []
  const total = logQuery.count ?? 0
  const lookups: LookupMaps = {
    courses: new Map((courses.data ?? []).map((c) => [c.kode_mk, c.nama_mk])),
    lecturers: new Map((lecturers.data ?? []).map((d) => [d.kode_dosen, d.nama])),
    rooms: new Map((rooms.data ?? []).map((r) => [r.id, r.nama])),
  }
  const identity = historyIdentity(tabel, rows, lookups)
  const deleted = rows[0]?.action === 'DELETE'
  const actors = new Set(rows.map((r) => r.actor_email ?? 'Sistem')).size

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/log-aktivitas" />
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
          <div className="pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem]">
            <Link href="/log-aktivitas" className="text-[0.87rem] text-[var(--biru)] hover:underline no-print">
              &lsaquo; Kembali ke Log Aktivitas
            </Link>
            <h1 className="text-[1.3rem] font-semibold mb-0 mt-[0.5rem]">
              Riwayat Perubahan <span className="text-[var(--tinta-3)] font-normal">— {tableLabel(tabel)}</span>
            </h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem] mb-0">
              {rows.length > 0
                ? `${rows.length} perubahan oleh ${actors} pengguna`
                : 'Belum ada perubahan yang tercatat.'}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-[0.93rem] text-[var(--tinta-3)]">
              {logQuery.error
                ? `Log gagal dimuat: ${humanDbError(logQuery.error)}`
                : 'Rekaman ini tidak punya entri di log — kemungkinan dibuat sebelum pencatatan dimulai.'}
            </p>
          ) : (
            <>
              {/* The record, in the words a scheduler would use — built from the log's own snapshots, so deleted records still resolve. */}
              <div className="bg-[var(--cekung)] border border-[var(--garis)] rounded-[var(--r-kecil)] px-[1rem] py-[0.8rem] mb-[1.6rem]">
                <div className="flex items-center justify-between gap-[0.8rem] flex-wrap">
                  <div className="min-w-0">
                    <p className="m-0 text-[1.07rem] font-semibold text-[var(--tinta)] text-balance">{identity.title}</p>
                    {identity.chips.length > 0 && (
                      <p className="m-0 mt-[0.25rem] text-[0.87rem] text-[var(--tinta-3)]">{identity.chips.join(' · ')}</p>
                    )}
                  </div>
                  {deleted && (
                    <span className="shrink-0 px-[0.5rem] py-[0.15rem] rounded-full border border-[var(--merah-garis)] bg-[var(--merah-lembut)] text-[var(--merah-teks)] text-[0.8rem] font-medium">
                      Dihapus
                    </span>
                  )}
                </div>
              </div>

              {total > HISTORY_LIMIT && (
                <p className="text-[0.8rem] text-[var(--kuning)] mb-[1rem]">
                  Menampilkan {HISTORY_LIMIT} perubahan terbaru dari total {total}.
                </p>
              )}

              <div className="relative">
                <span aria-hidden className="absolute left-[4.5px] top-[0.7rem] bottom-[0.7rem] w-px bg-[var(--garis)]" />
                <ol className="relative m-0 p-0 list-none space-y-[1.5rem]">
                {rows.map((row) => {
                  const fields = row.action === 'UPDATE' ? changedHistoryFields(row) : snapshotFields(row)
                  return (
                    <li key={row.id} className="relative pl-[1.7rem]">
                      <span aria-hidden className={`absolute left-0 top-[0.4rem] size-[10px] rounded-full border-2 border-[var(--lembar)] ${ACTION_DOT[row.action]}`} />
                      <p className="m-0 flex items-center gap-[0.55rem] flex-wrap text-[0.87rem]">
                        <time dateTime={row.at} className="font-medium whitespace-nowrap">
                          {new Date(row.at).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </time>
                        <span className={`px-[0.4rem] py-[0.05rem] rounded-full text-[0.75rem] font-medium ${ACTION_BADGE[row.action]}`}>
                          {ACTION_LABEL[row.action]}
                        </span>
                        <span className="text-[var(--tinta-3)] truncate max-w-[16rem]">{row.actor_email ?? 'Sistem'}</span>
                      </p>

                      {fields.length > 0 ? (
                        <dl className="m-0 mt-[0.5rem] space-y-[0.35rem]">
                          {fields.map((f) => (
                            <div key={f} className="flex items-baseline gap-[0.6rem] flex-wrap">
                              <dt className="w-[8.5rem] shrink-0 text-[0.8rem] text-[var(--tinta-3)]">{fieldLabel(f)}</dt>
                              <dd className="m-0 min-w-0 flex items-baseline gap-[0.4rem] flex-wrap text-[0.87rem] break-words">
                                {row.action === 'UPDATE' && (
                                  <>
                                    <span className="px-[0.35rem] py-[0.05rem] rounded-[3px] bg-[var(--merah-lembut)] text-[var(--merah-teks)] whitespace-pre-wrap">
                                      {historyValue(f, row.old_data?.[f], lookups)}
                                    </span>
                                    <span aria-hidden className="text-[var(--tinta-3)]">&rarr;</span>
                                  </>
                                )}
                                <span
                                  className={`px-[0.35rem] py-[0.05rem] rounded-[3px] whitespace-pre-wrap ${
                                    row.action === 'DELETE' ? 'bg-[var(--merah-lembut)] text-[var(--merah-teks)]' : row.action === 'UPDATE' ? 'bg-[var(--hijau-lembut)] text-[var(--hijau)]' : ''
                                  }`}
                                >
                                  {historyValue(f, row.new_data?.[f] ?? row.old_data?.[f], lookups)}
                                </span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="m-0 mt-[0.4rem] text-[0.87rem] text-[var(--tinta-3)]">
                          {row.action === 'UPDATE' ? 'Tidak ada kolom yang benar-benar berubah.' : 'Tidak ada rincian kolom.'}
                        </p>
                      )}
                    </li>
                  )
                })}
                </ol>
              </div>

              <p className="m-0 mt-[1.6rem] pt-[1rem] border-t border-[var(--garis)] text-[0.8rem] mono text-[var(--tinta-3)]">
                ID rekaman: {id}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function snapshotFields(row: AuditRow): string[] {
  const data = row.action === 'DELETE' ? row.old_data : row.new_data
  if (!data) return []
  return Object.keys(data).filter((k) => {
    const shown = historyValue(k, data[k], EMPTY_LOOKUPS)
    return !IMMUTABLE_SKIPS.has(k) && shown !== '—' && shown !== '(kosong)' && shown !== ''
  })
}
