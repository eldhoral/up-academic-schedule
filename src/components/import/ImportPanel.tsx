'use client'

import { useRef, useState, useTransition } from 'react'
import { commitImportAction, previewImportAction, type PreviewState } from '@/lib/import/actions'
import type { ImportTableSlug } from '@/lib/import/tables'
import type { RowOutcome } from '@/lib/import/engine'

const STATUS_LABEL: Record<RowOutcome<Record<string, unknown>>['status'], string> = {
  new: 'New',
  changed: 'Changed',
  unchanged: 'Unchanged',
  rejected: 'Rejected',
}

const STATUS_CLASS: Record<RowOutcome<Record<string, unknown>>['status'], string> = {
  new: 'bg-[var(--biru-lembut)] text-[var(--biru)]',
  changed: 'bg-[var(--kuning-lembut)] text-[var(--kuning)]',
  unchanged: 'bg-[var(--cekung)] text-[var(--tinta-3)]',
  rejected: 'bg-[var(--merah-lembut)] text-[var(--merah)]',
}

export function ImportPanel({
  tableSlug,
  label,
  onCommitted,
}: {
  tableSlug: ImportTableSlug
  label: string
  onCommitted: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [commitMessage, setCommitMessage] = useState<string | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [isPreviewing, startPreview] = useTransition()
  const [isCommitting, startCommit] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setCommitMessage(null)
    setCommitError(null)
    setPreview(null)
    if (!file) return

    const formData = new FormData()
    formData.set('file', file)
    startPreview(async () => {
      const result = await previewImportAction(tableSlug, formData)
      setPreview(result)
    })
  }

  function handleCommit() {
    if (!preview?.ok) return
    const rows = preview.preview.rows
      .filter((r): r is Extract<typeof r, { status: 'new' | 'changed' }> => r.status === 'new' || r.status === 'changed')
      .map((r) => r.data)

    startCommit(async () => {
      const result = await commitImportAction(tableSlug, rows)
      if (result.ok) {
        setCommitMessage(`${result.written} row${result.written === 1 ? '' : 's'} written.`)
        setPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        onCommitted()
      } else {
        setCommitError(result.error)
      }
    })
  }

  const counts = preview?.ok ? preview.preview.counts : null
  const writable = counts ? counts.new + counts.changed : 0

  return (
    <div className="border border-[var(--garis)] rounded-[var(--r-sedang)] bg-[var(--lembar)] p-[1.2rem]">
      <div className="flex items-center justify-between gap-[1rem] flex-wrap mb-[0.8rem]">
        <div>
          <h3 className="m-0 text-[1rem] font-semibold">Import {label}</h3>
          <p className="mt-[0.2rem] text-[0.87rem] text-[var(--tinta-3)]">
            Download the template, fill it in Excel, then upload to preview before committing.
          </p>
        </div>
        <div className="flex gap-[0.5rem] shrink-0">
          <a
            href={`/api/export/${tableSlug}`}
            download
            className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] font-medium text-[var(--tinta-2)] hover:bg-[var(--cekung)] transition-colors"
          >
            Export data
          </a>
          <a
            href={`/api/import/${tableSlug}/template`}
            download
            className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] font-medium text-[var(--tinta-2)] hover:bg-[var(--cekung)] transition-colors"
          >
            Download template
          </a>
        </div>
      </div>

      <div className="flex items-center gap-[0.8rem] flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          className="text-[0.87rem] text-[var(--tinta-2)] file:mr-[0.6rem] file:px-[0.6rem] file:py-[0.4rem] file:rounded-[var(--r-kecil)] file:border file:border-[var(--garis-kuat)] file:bg-[var(--cekung)] file:text-[var(--tinta-2)] file:cursor-pointer cursor-pointer"
        />
        {isPreviewing && <span className="text-[0.87rem] text-[var(--tinta-3)]">Reading file…</span>}
      </div>

      {preview && !preview.ok && (
        <p className="mt-[0.8rem] text-[0.87rem] text-[var(--merah)]">{preview.error}</p>
      )}

      {commitError && <p className="mt-[0.8rem] text-[0.87rem] text-[var(--merah)]">{commitError}</p>}
      {commitMessage && <p className="mt-[0.8rem] text-[0.87rem] text-[var(--hijau)]">{commitMessage}</p>}

      {preview?.ok && counts && (
        <div className="mt-[1rem]">
          <div className="flex items-center gap-[0.6rem] flex-wrap mb-[0.8rem] text-[0.87rem]">
            <CountBadge label="New" count={counts.new} statusKey="new" />
            <CountBadge label="Changed" count={counts.changed} statusKey="changed" />
            <CountBadge label="Unchanged" count={counts.unchanged} statusKey="unchanged" />
            <CountBadge label="Rejected" count={counts.rejected} statusKey="rejected" />
          </div>

          <div className="max-h-[20rem] overflow-y-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
            <table className="w-full text-[0.87rem] border-collapse">
              <thead className="sticky top-0 bg-[var(--cekung)]">
                <tr>
                  <th className="text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)]">Status</th>
                  <th className="text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)]">Key</th>
                  <th className="text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)]">Detail</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-[var(--garis)]">
                    <td className="px-[0.6rem] py-[0.4rem] align-top">
                      <span className={`inline-block px-[0.4rem] py-[0.1rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium ${STATUS_CLASS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-[0.6rem] py-[0.4rem] align-top mono">{row.key}</td>
                    <td className="px-[0.6rem] py-[0.4rem] align-top text-[var(--tinta-2)]">
                      {row.status === 'rejected' ? (
                        <span className="text-[var(--merah)]">{row.reason}</span>
                      ) : (
                        <>
                          {row.notes.length > 0 && (
                            <ul className="m-0 pl-[1rem] text-[0.8rem] text-[var(--tinta-3)] list-disc">
                              {row.notes.map((note, j) => (
                                <li key={j}>{note}</li>
                              ))}
                            </ul>
                          )}
                          {row.notes.length === 0 && row.status === 'unchanged' && (
                            <span className="text-[var(--tinta-3)]">No change.</span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleCommit}
            disabled={writable === 0 || isCommitting}
            className="mt-[0.8rem] px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer transition-colors hover:bg-[var(--biru-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
          >
            {isCommitting ? 'Writing…' : `Commit ${writable} row${writable === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  )
}

function CountBadge({
  label,
  count,
  statusKey,
}: {
  label: string
  count: number
  statusKey: RowOutcome<Record<string, unknown>>['status']
}) {
  return (
    <span className={`px-[0.5rem] py-[0.2rem] rounded-[var(--r-kecil)] font-medium ${STATUS_CLASS[statusKey]}`}>
      {label} {count}
    </span>
  )
}
