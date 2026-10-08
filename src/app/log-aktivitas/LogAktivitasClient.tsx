'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ACTION_LABEL,
  LOG_PAGE_SIZE,
  TABLE_LABEL,
  changedFields,
  formatValue,
  summarize,
  tableLabel,
  type AuditAction,
  type AuditRow,
  type LogFilters,
} from '@/lib/audit-log'

const ACTION_BADGE: Record<AuditAction, string> = {
  INSERT: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]',
  UPDATE: 'bg-[var(--biru-lembut)] text-[var(--biru)]',
  DELETE: 'bg-[var(--merah-lembut)] text-[var(--merah)]',
  LOGIN: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]',
  LOGOUT: 'bg-[var(--cekung)] text-[var(--tinta-3)]',
}

const TABLES = Object.keys(TABLE_LABEL).sort((a, b) => tableLabel(a).localeCompare(tableLabel(b)))

/** The URL for these filters with `patch` applied; any filter change goes back to page 1. */
function logHref(filters: LogFilters, patch: Partial<LogFilters>): string {
  const f = { ...filters, page: 1, ...patch }
  const params = new URLSearchParams()
  if (f.page > 1) params.set('hal', String(f.page))
  if (f.table) params.set('tabel', f.table)
  if (f.action) params.set('aksi', f.action)
  if (f.q) params.set('q', f.q)
  if (f.from) params.set('dari', f.from)
  if (f.to) params.set('sampai', f.to)
  const qs = params.toString()
  return qs ? `/log-aktivitas?${qs}` : '/log-aktivitas'
}

const inputClass = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]'

export function LogAktivitasClient({ rows, total, filters }: { rows: AuditRow[]; total: number; filters: LogFilters }) {
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE))
  const first = (filters.page - 1) * LOG_PAGE_SIZE + 1
  const filtered = !!(filters.table || filters.action || filters.q || filters.from || filters.to)

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Log Aktivitas</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            {rows.length > 0 ? (
              <>
                {first}&ndash;{first + rows.length - 1} dari {total} perubahan
              </>
            ) : (
              <>{total} perubahan</>
            )}
          </p>
        </div>

        {/* A plain GET form: the filters live in the URL, so a filtered view can be bookmarked or shared. */}
        <form action="/log-aktivitas" className="flex items-end gap-[0.53rem] flex-wrap mb-[1rem]">
          {filters.table && <input type="hidden" name="tabel" value={filters.table} />}
          {filters.action && <input type="hidden" name="aksi" value={filters.action} />}
          <input
            type="search"
            name="q"
            placeholder="Cari email atau ID rekaman…"
            defaultValue={filters.q}
            aria-label="Cari email atau ID rekaman"
            className={`w-full max-w-[20rem] ${inputClass}`}
          />
          <label className="text-[0.8rem] text-[var(--tinta-3)]">
            Dari
            <input type="date" name="dari" defaultValue={filters.from ?? ''} className={`ml-[0.4rem] ${inputClass}`} />
          </label>
          <label className="text-[0.8rem] text-[var(--tinta-3)]">
            Sampai
            <input type="date" name="sampai" defaultValue={filters.to ?? ''} className={`ml-[0.4rem] ${inputClass}`} />
          </label>
          <button
            type="submit"
            className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)]"
          >
            Terapkan
          </button>
          {filtered && (
            <Link href="/log-aktivitas" className="text-[0.87rem] text-[var(--biru)] hover:underline py-[0.4rem]">
              Hapus filter
            </Link>
          )}
        </form>

        <div className="flex items-center gap-[0.4rem] flex-wrap mb-[1rem]">
          <FilterChip active={!filters.action} href={logHref(filters, { action: null })}>
            Semua aksi
          </FilterChip>
          {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
            <FilterChip key={a} active={filters.action === a} href={logHref(filters, { action: a })}>
              {ACTION_LABEL[a]}
            </FilterChip>
          ))}
        </div>

        <div className="flex items-center gap-[0.4rem] flex-wrap mb-[1rem]">
          <FilterChip active={!filters.table} href={logHref(filters, { table: null })}>
            Semua data
          </FilterChip>
          {TABLES.map((t) => (
            <FilterChip key={t} active={filters.table === t} href={logHref(filters, { table: t })}>
              {tableLabel(t)}
            </FilterChip>
          ))}
        </div>

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Waktu</Th>
                <Th>Aksi</Th>
                <Th>Data</Th>
                <Th>ID</Th>
                <Th>Pengguna</Th>
                <Th>Ringkasan</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="whitespace-nowrap text-[var(--tinta-3)]">
                    {new Date(r.at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Td>
                  <Td>
                    <span className={`inline-block px-[0.4rem] py-[0.05rem] rounded-full text-[0.75rem] font-medium ${ACTION_BADGE[r.action]}`}>
                      {ACTION_LABEL[r.action]}
                    </span>
                  </Td>
                  <Td>{tableLabel(r.table_name)}</Td>
                  <Td className="mono text-[0.8rem] text-[var(--tinta-3)]">{r.record_id ?? '—'}</Td>
                  <Td>{r.actor_email ?? <span className="text-[var(--tinta-3)]">Sistem</span>}</Td>
                  <Td className="text-[var(--tinta-2)] max-w-[20rem] truncate">{summarize(r)}</Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                    >
                      Detail
                    </button>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {filtered ? 'Tidak ada aktivitas yang cocok dengan filter ini.' : 'Belum ada aktivitas tercatat.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <nav aria-label="Halaman log" className="flex items-center justify-end gap-[0.6rem] mt-[1rem] text-[0.87rem]">
            {filters.page > 1 && (
              <Link href={logHref(filters, { page: filters.page - 1 })} className="text-[var(--biru)] hover:underline">
                &lsaquo; Sebelumnya
              </Link>
            )}
            <span className="text-[var(--tinta-3)]">
              Halaman {filters.page} dari {pages}
            </span>
            {filters.page < pages && (
              <Link href={logHref(filters, { page: filters.page + 1 })} className="text-[var(--biru)] hover:underline">
                Berikutnya &rsaquo;
              </Link>
            )}
          </nav>
        )}
      </div>

      {selected && <DetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DetailModal({ row, onClose }: { row: AuditRow; onClose: () => void }) {
  const fields = changedFields(row)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[34rem] max-h-[85vh] overflow-y-auto bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[0.8rem] mb-[0.2rem]">
          <h3 className="m-0 text-[1.07rem] font-semibold">
            {row.action === 'LOGIN' || row.action === 'LOGOUT' ? ACTION_LABEL[row.action] : `${ACTION_LABEL[row.action]} ${tableLabel(row.table_name)}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 text-[var(--tinta-3)] hover:text-[var(--tinta)] cursor-pointer bg-transparent border-0 p-0 text-[1.2rem] leading-none"
          >
            &times;
          </button>
        </div>
        <p className="mt-0 mb-[1.1rem] text-[0.8rem] mono text-[var(--tinta-3)]">
          {row.record_id ?? '—'} &middot; {new Date(row.at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} &middot;{' '}
          {row.actor_email ?? 'Sistem'}
        </p>

        {fields.length === 0 && (
          <p className="text-[0.87rem] text-[var(--tinta-3)]">
            {row.action === 'LOGIN' || row.action === 'LOGOUT' ? 'Tidak ada rincian tambahan untuk peristiwa ini.' : 'Tidak ada kolom yang berubah.'}
          </p>
        )}

        {fields.length > 0 && (
          <div className="border border-[var(--garis)] rounded-[var(--r-kecil)] overflow-hidden">
            <table className="w-full text-[0.8rem] border-collapse">
              <thead className="bg-[var(--cekung)]">
                <tr>
                  <Th>Kolom</Th>
                  {row.action !== 'INSERT' && <Th>Sebelum</Th>}
                  {row.action !== 'DELETE' && <Th>Sesudah</Th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f} className="border-t border-[var(--garis)]">
                    <Td className="mono font-medium">{f}</Td>
                    {row.action !== 'INSERT' && (
                      <Td className="text-[var(--tinta-3)] whitespace-pre-wrap break-words">{formatValue(row.old_data?.[f])}</Td>
                    )}
                    {row.action !== 'DELETE' && <Td className="whitespace-pre-wrap break-words">{formatValue(row.new_data?.[f])}</Td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-[1.2rem]">
          <button
            type="button"
            onClick={onClose}
            className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium border transition-colors ${
        active
          ? 'bg-[var(--biru-lembut)] text-[var(--biru)] border-[var(--biru)]/30'
          : 'bg-[var(--lembar)] text-[var(--tinta-3)] border-[var(--garis-kuat)] hover:bg-[var(--cekung)]'
      }`}
    >
      {children}
    </Link>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)] ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[0.6rem] py-[0.4rem] ${className}`}>{children}</td>
}
