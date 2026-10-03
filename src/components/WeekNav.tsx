'use client'

import { Select } from './Select'
import { weekLabel } from '@/lib/week'

/**
 * Steps between the weeks that have something on them (exam week, defense days), with a
 * picker for the rest: a dated calendar is mostly empty weeks, so ‹ › skip straight to the
 * next week with events instead of crawling one week at a time.
 */
export function WeekNav({ weeks, current, counts, onChange }: { weeks: string[]; current: string; counts: Record<string, number>; onChange: (monday: string) => void }) {
  const all = [...new Set([...weeks, current])].sort()
  const prev = weeks.filter((w) => w < current).at(-1)
  const next = weeks.find((w) => w > current)
  const step = 'min-w-[2.4rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[1.07rem] transition-colors'

  return (
    <div className="flex items-center gap-[0.4rem]" role="group" aria-label="Minggu">
      <button type="button" onClick={() => prev && onChange(prev)} disabled={!prev} aria-label="Minggu sebelumnya yang berisi jadwal" className={`${step} bg-[var(--lembar)] cursor-pointer hover:bg-[var(--cekung)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-[var(--lembar)]`}>
        ‹
      </button>
      <Select
        value={current}
        onValueChange={onChange}
        ariaLabel="Pilih minggu"
        options={all.map((w) => ({ value: w, label: `${weekLabel(w)}${counts[w] ? ` · ${counts[w]}` : ''}` }))}
        className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem] mono"
      />
      <button type="button" onClick={() => next && onChange(next)} disabled={!next} aria-label="Minggu berikutnya yang berisi jadwal" className={`${step} bg-[var(--lembar)] cursor-pointer hover:bg-[var(--cekung)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-[var(--lembar)]`}>
        ›
      </button>
    </div>
  )
}
