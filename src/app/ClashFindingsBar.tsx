'use client'

import { useState } from 'react'
import { hariLabel } from '@/lib/hari'
import type { ClashFinding, ClashFindingSide } from './clash-actions'

const REASON: Record<ClashFinding['type'], (detail: string) => string> = {
  dosen: (detail) => `${detail} teaches both at the same time`,
  kelas: (detail) => `Same kelas (${detail}) double-booked`,
  ruangan: (detail) => `Room ${detail} double-booked`,
}

export function ClashFindingsBar({
  clashes,
  academicYearLabel,
  onView,
}: {
  clashes: ClashFinding[]
  academicYearLabel: string
  onView: (side: ClashFindingSide) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const blocking = clashes.filter((c) => c.policy === 'blok').length
  const warning = clashes.length - blocking

  if (clashes.length === 0) {
    return (
      <div className="flex items-center gap-[0.53rem] px-[1rem] py-[0.53rem] mb-[1rem] bg-[var(--hijau-lembut)] border border-[var(--hijau)]/25 rounded-[var(--r-sedang)] text-[0.87rem] text-[var(--hijau)]">
        <span aria-hidden="true">&#10003;</span>
        No clashes in {academicYearLabel}.
      </div>
    )
  }

  return (
    <div className="border border-[var(--merah-garis)] rounded-[var(--r-sedang)] bg-[var(--lembar)] overflow-hidden mb-[1rem]">
      <div className="flex items-center gap-[0.8rem] px-[1rem] py-[0.67rem] bg-[var(--merah-lembut)] border-b border-[var(--merah-garis)] flex-wrap">
        <span className="text-[1.87rem] font-semibold text-[var(--merah)] tracking-[-0.025em] leading-none">
          {clashes.length}
        </span>
        <b className="text-[1rem] font-semibold">clash{clashes.length === 1 ? '' : 'es'} to resolve</b>
        <span className="text-[0.93rem] text-[var(--tinta-2)]">
          across {academicYearLabel} &middot; {blocking} blocking{warning > 0 ? ` · ${warning} warning` : ''}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto px-[0.7rem] py-[0.33rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--lembar)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)] transition-colors"
        >
          {collapsed ? 'Show' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
        <ol className="m-0 p-0 list-none">
          {clashes.map((c, i) => (
            <li
              key={i}
              className="flex items-baseline gap-[0.8rem] px-[1rem] py-[0.67rem] border-b border-[var(--garis)] last:border-b-0 hover:bg-[var(--cekung)] transition-colors flex-wrap"
            >
              <span className="w-[13rem] shrink-0 text-[0.87rem] text-[var(--tinta-3)] mono">
                Semester {c.a.semester_ke} &middot; Kelas {c.a.kelas}
              </span>
              <span className="flex-1 min-w-[16rem] text-[1rem]">
                <b className="font-semibold">{c.a.nama_mk}</b> and <b className="font-semibold">{c.b.nama_mk}</b> run at
                the same time on {hariLabel(c.a.hari)} &mdash; {REASON[c.type](c.detail)}.
                {c.policy === 'peringatan' && (
                  <span className="ml-[0.4rem] inline-block text-[0.8rem] px-[0.4rem] py-[0.05rem] rounded-full bg-[var(--kuning-lembut)] border border-[var(--kuning-garis)] text-[var(--kuning)]">
                    Warning
                  </span>
                )}
              </span>
              <span className="w-[4.7rem] shrink-0 text-right text-[0.87rem] text-[var(--merah)] mono">
                {c.overlapMinutes} min
              </span>
              <button
                type="button"
                onClick={() => onView(c.a)}
                className="shrink-0 bg-transparent border-0 p-0 text-[0.87rem] text-[var(--biru)] hover:underline cursor-pointer"
              >
                View
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
