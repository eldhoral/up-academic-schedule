'use client'

import { useState } from 'react'
import { Select } from './Select'

export type PersonValue = { kode_dosen: string } | { nama: string } | null

const MANUAL = '__manual__'
const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]'

/**
 * Picks a dosen from the master, one of a few fixed non-dosen names (e.g. AKADEMIK), or
 * "Isi manual…" for free text. The value says which: `{ kode_dosen }` or `{ nama }`.
 */
export function PersonField({
  value,
  onChange,
  dosen,
  fixedNames,
  ariaLabel,
}: {
  value: PersonValue
  onChange: (next: PersonValue) => void
  dosen: { value: string; label: string }[] // value = kode_dosen
  fixedNames: string[]
  ariaLabel: string
}) {
  const typed = value && 'nama' in value ? value.nama : null
  const [manual, setManual] = useState(typed !== null && !fixedNames.includes(typed))

  const selected = manual ? MANUAL : value && 'kode_dosen' in value ? `d:${value.kode_dosen}` : typed !== null ? `n:${typed}` : ''

  function pick(v: string) {
    setManual(v === MANUAL)
    if (v === MANUAL) onChange({ nama: '' })
    else if (v.startsWith('d:')) onChange({ kode_dosen: v.slice(2) })
    else onChange({ nama: v.slice(2) })
  }

  return (
    <div className="space-y-[0.27rem]">
      <Select
        value={selected}
        onValueChange={pick}
        placeholder="— pilih pengawas —"
        ariaLabel={ariaLabel}
        options={[
          ...fixedNames.map((n) => ({ value: `n:${n}`, label: n })),
          ...dosen.map((d) => ({ value: `d:${d.value}`, label: d.label })),
          { value: MANUAL, label: 'Isi manual…' },
        ]}
        className={`w-full ${CONTROL}`}
      />
      {manual && (
        <input
          type="text"
          value={typed ?? ''}
          onChange={(e) => onChange({ nama: e.target.value })}
          placeholder="Nama pengawas"
          aria-label={`${ariaLabel} (nama manual)`}
          className={`w-full ${CONTROL}`}
        />
      )}
    </div>
  )
}
