'use client'

import { useState } from 'react'
import {
  ACTION_LABEL,
  changedFields,
  formatValue,
  summarize,
  tableLabel,
  type AuditAction,
  type AuditRow,
} from '@/lib/audit-log'

const ACTION_BADGE: Record<AuditAction, string> = {
  INSERT: 'bg-[var(--hijau-lembut)] text-[var(--hijau)]',
  UPDATE: 'bg-[var(--biru-lembut)] text-[var(--biru)]',
  DELETE: 'bg-[var(--merah-lembut)] text-[var(--merah)]',
}

export function LogAktivitasClient({ rows }: { rows: AuditRow[] }) {
  const [query, setQuery] = useState('')
  const [tableFilter, setTableFilter] = useState('semua')
  const [actionFilter, setActionFilter] = useState<'semua' | AuditAction>('semua')
  const [selected, setSelected] = useState<AuditRow | null>(null)

  const tablesPresent = Array.from(new Set(rows.map((r) => r.table_name))).sort((a, b) =>
    tableLabel(a).localeCompare(tableLabel(b))
  )

  const filtered = rows.filter((r) => {
    if (tableFilter !== 'semua' && r.table_name !== tableFilter) return false
    if (actionFilter !== 'semua' && r.action !== actionFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (r.actor_email ?? '').toLowerCase().includes(q) || (r.record_id ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Log Aktivitas</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            {filtered.length} dari {rows.length} perubahan &middot; 500 terbaru
          </p>
        </div>

        <div className="flex items-center gap-[0.53rem] flex-wrap mb-[1rem]">
          <input
            type="search"
            placeholder="Cari email atau ID rekaman…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-[20rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
          />
          <div className="flex items-center gap-[0.4rem] flex-wrap">
            <FilterChip active={actionFilter === 'semua'} onClick={() => setActionFilter('semua')}>
              Semua aksi
            </FilterChip>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
              <FilterChip key={a} active={actionFilter === a} onClick={() => setActionFilter(a)}>
                {ACTION_LABEL[a]}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-[0.4rem] flex-wrap mb-[1rem]">
          <FilterChip active={tableFilter === 'semua'} onClick={() => setTableFilter('semua')}>
            Semua data
          </FilterChip>
          {tablesPresent.map((t) => (
            <FilterChip key={t} active={tableFilter === t} onClick={() => setTableFilter(t)}>
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
              {filtered.map((r) => (
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {rows.length === 0 ? 'Belum ada aktivitas tercatat.' : 'Tidak ada aktivitas yang cocok dengan filter ini.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            {ACTION_LABEL[row.action]} {tableLabel(row.table_name)}
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

        {fields.length === 0 && <p className="text-[0.87rem] text-[var(--tinta-3)]">Tidak ada kolom yang berubah.</p>}

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
                    {row.action !== 'INSERT' && <Td className="text-[var(--tinta-3)]">{formatValue(row.old_data?.[f])}</Td>}
                    {row.action !== 'DELETE' && <Td>{formatValue(row.new_data?.[f])}</Td>}
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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium border transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--biru-lembut)] text-[var(--biru)] border-[var(--biru)]/30'
          : 'bg-[var(--lembar)] text-[var(--tinta-3)] border-[var(--garis-kuat)] hover:bg-[var(--cekung)]'
      }`}
    >
      {children}
    </button>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)] ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[0.6rem] py-[0.4rem] ${className}`}>{children}</td>
}
