'use client'

import { useState, type ReactNode } from 'react'

export type Finding<T> = {
  policy: 'blok' | 'peringatan'
  where: string // left column, e.g. "Semester 3 · Kelas A"
  text: ReactNode
  minutes: number
  target: T // handed back to onView
}

/**
 * The standing, always-visible clash summary above a schedule: a big red count when there
 * are clashes, a quiet green line when clean. Shared by kuliah, ujian and sidang; each maps
 * its own clash shape into `Finding`. `notes` are softer, non-clash gaps (kuning tier).
 */
export function FindingsBar<T>({
  findings,
  scopeLabel,
  notes = [],
  onView,
}: {
  findings: Finding<T>[]
  scopeLabel: string
  notes?: string[]
  onView?: (target: T) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const blocking = findings.filter((f) => f.policy === 'blok').length
  const warning = findings.length - blocking

  return (
    <div className="mb-[1rem] space-y-[0.53rem]">
      {findings.length === 0 ? (
        <div className="flex items-center gap-[0.53rem] px-[1rem] py-[0.53rem] bg-[var(--hijau-lembut)] border border-[var(--hijau)]/25 rounded-[var(--r-sedang)] text-[0.87rem] text-[var(--hijau)]">
          <span aria-hidden="true">&#10003;</span>
          Tidak ada bentrokan di {scopeLabel}.
        </div>
      ) : (
        <div className="border border-[var(--merah-garis)] rounded-[var(--r-sedang)] bg-[var(--lembar)] overflow-hidden">
          <div className="flex items-center gap-[0.8rem] px-[1rem] py-[0.67rem] bg-[var(--merah-lembut)] border-b border-[var(--merah-garis)] flex-wrap">
            <span className="text-[1.87rem] font-semibold text-[var(--merah)] tracking-[-0.025em] leading-none">{findings.length}</span>
            <b className="text-[1rem] font-semibold">bentrokan jadwal perlu diperbaiki</b>
            <span className="text-[0.93rem] text-[var(--tinta-2)]">
              di {scopeLabel} &middot; {blocking} diblokir{warning > 0 ? ` · ${warning} peringatan` : ''}
            </span>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="ml-auto px-[0.7rem] py-[0.33rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)] transition-colors"
            >
              {collapsed ? 'Tampilkan' : 'Tutup'}
            </button>
          </div>

          {!collapsed && (
            <ol className="m-0 p-0 list-none">
              {findings.map((f, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-[0.8rem] px-[1rem] py-[0.67rem] border-b border-[var(--garis)] last:border-b-0 hover:bg-[var(--cekung)] transition-colors flex-wrap"
                >
                  <span className="w-[13rem] shrink-0 text-[0.87rem] text-[var(--tinta-3)] mono">{f.where}</span>
                  <span className="flex-1 min-w-[16rem] text-[1rem]">
                    {f.text}
                    {f.policy === 'peringatan' && (
                      <span className="ml-[0.4rem] inline-block text-[0.8rem] px-[0.4rem] py-[0.05rem] rounded-full bg-[var(--kuning-lembut)] border border-[var(--kuning-garis)] text-[var(--kuning)]">
                        Peringatan
                      </span>
                    )}
                  </span>
                  <span className="w-[4.7rem] shrink-0 text-right text-[0.87rem] text-[var(--merah)] mono">{f.minutes} menit</span>
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(f.target)}
                      className="shrink-0 bg-transparent border-0 p-0 text-[0.87rem] text-[var(--biru)] hover:underline cursor-pointer"
                    >
                      Lihat
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <ul className="m-0 list-none px-[1rem] py-[0.53rem] bg-[var(--kuning-lembut)] border border-[var(--kuning-garis)] rounded-[var(--r-sedang)] text-[0.87rem] text-[var(--kuning)]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
