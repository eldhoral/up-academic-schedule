'use client'

import { useActionState, useState } from 'react'
import { Select } from '@/components/Select'
import { saveSettingsAction, type FormState } from './actions'

export type SettingRow = {
  key: string
  value: string
  type: 'int' | 'time' | 'text' | 'bool' | 'image'
  group: string
  label: string
  help: string
  urutan: number
}

const GROUP_ORDER = ['waktu', 'kelas', 'bentrok', 'cetak']
const GROUP_LABEL: Record<string, string> = {
  waktu: 'Waktu & Sesi',
  kelas: 'Kelas',
  bentrok: 'Bentrok',
  cetak: 'Cetak',
}

const SELECT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  bentrok_dosen: [
    { value: 'blok', label: 'Blok' },
    { value: 'peringatan', label: 'Peringatan' },
    { value: 'abaikan', label: 'Abaikan' },
  ],
  bentrok_kelas: [
    { value: 'blok', label: 'Blok' },
    { value: 'peringatan', label: 'Peringatan' },
    { value: 'abaikan', label: 'Abaikan' },
  ],
  bentrok_ruangan: [
    { value: 'blok', label: 'Blok' },
    { value: 'peringatan', label: 'Peringatan' },
    { value: 'abaikan', label: 'Abaikan' },
  ],
  izinkan_override: [
    { value: 'ya', label: 'Ya' },
    { value: 'tidak', label: 'Tidak' },
  ],
}

const TEXTAREA_KEYS = new Set(['header_baris', 'keterangan_cetak'])
const HARI = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']

export function PengaturanClient({ settings }: { settings: SettingRow[] }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(saveSettingsAction, null)

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    rows: settings.filter((s) => s.group === g).sort((a, b) => a.urutan - b.urutan),
  })).filter((g) => g.rows.length > 0)

  return (
    <form action={formAction} className="space-y-[1.2rem]">
      {state && 'error' in state && (
        <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.7rem] text-[0.87rem] text-[var(--merah)]">
          {state.error}
        </div>
      )}
      {state && 'success' in state && (
        <div className="bg-[var(--hijau-lembut)] border border-[var(--hijau)]/30 rounded-[var(--r-kecil)] p-[0.7rem] text-[0.87rem] text-[var(--hijau)]">
          Settings saved.
        </div>
      )}

      {settings.length === 0 && (
        <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem] text-center text-[0.93rem] text-[var(--tinta-3)]">
          No settings found. Run the seed migration to populate the default keys.
        </div>
      )}

      {groups.map(({ group, rows }) => (
        <section key={group} className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
          <h2 className="m-0 text-[1.07rem] font-semibold mb-[1rem] pb-[0.8rem] border-b border-[var(--garis)]">
            {GROUP_LABEL[group] ?? group}
          </h2>
          <div className="space-y-[1rem]">
            {rows.map((row) => (
              <SettingField key={row.key} row={row} />
            ))}
          </div>
        </section>
      ))}

      <button
        type="submit"
        disabled={isPending || settings.length === 0}
        className="px-[1rem] py-[0.6rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.93rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}

function SettingField({ row }: { row: SettingRow }) {
  const name = `setting:${row.key}`

  return (
    <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-[0.3rem_1.2rem] items-start">
      <div>
        <label htmlFor={name} className="block text-[0.93rem] font-medium">
          {row.label}
        </label>
        {row.help && <p className="mt-[0.15rem] text-[0.8rem] text-[var(--tinta-3)] leading-[1.4]">{row.help}</p>}
      </div>
      <div className="max-w-[26rem]">
        <SettingInput row={row} name={name} />
      </div>
    </div>
  )
}

function SettingInput({ row, name }: { row: SettingRow; name: string }) {
  if (row.key === 'hari_aktif') return <HariAktifField name={name} value={row.value} />
  if (row.key === 'gambar_tanda_tangan') return <ImageField name={name} value={row.value} />

  const options = SELECT_OPTIONS[row.key]
  if (options) {
    return (
      <Select
        id={name}
        name={name}
        defaultValue={row.value}
        options={options}
        className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
      />
    )
  }

  if (TEXTAREA_KEYS.has(row.key)) {
    return (
      <textarea
        id={name}
        name={name}
        defaultValue={row.value}
        rows={4}
        className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
      />
    )
  }

  if (row.type === 'bool') return <BoolField name={name} value={row.value} />

  const inputType = row.type === 'int' ? 'number' : row.type === 'time' ? 'time' : 'text'
  return (
    <input
      id={name}
      name={name}
      type={inputType}
      defaultValue={row.value}
      className={`w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem] ${
        inputType !== 'text' ? 'mono' : ''
      }`}
    />
  )
}

function HariAktifField({ name, value }: { name: string; value: string }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(value.split(',').map((s) => s.trim()).filter(Boolean)))

  function toggle(day: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  return (
    <div>
      <input type="hidden" name={name} value={HARI.filter((d) => checked.has(d)).join(',')} />
      <div className="flex gap-[0.4rem] flex-wrap">
        {HARI.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={checked.has(day)}
            className={`px-[0.6rem] py-[0.35rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium border transition-colors ${
              checked.has(day)
                ? 'bg-[var(--biru-lembut)] text-[var(--biru)] border-[var(--biru)]/30'
                : 'bg-[var(--lembar)] text-[var(--tinta-3)] border-[var(--garis-kuat)] hover:bg-[var(--cekung)]'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}

function BoolField({ name, value }: { name: string; value: string }) {
  const [on, setOn] = useState(value === 'ya' || value === 'true' || value === '1')
  return (
    <label className="flex items-center gap-[0.5rem] text-[0.93rem]">
      <input type="hidden" name={name} value={on ? 'ya' : 'tidak'} />
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="w-[1rem] h-[1rem]" />
      {on ? 'Ya' : 'Tidak'}
    </label>
  )
}

function ImageField({ name, value }: { name: string; value: string }) {
  const [data, setData] = useState(value)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setData(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-[0.5rem]">
      <input type="hidden" name={name} value={data} />
      {data && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data} alt="Tanda tangan" className="h-[3rem] border border-[var(--garis)] rounded-[var(--r-kecil)] bg-white p-[0.3rem]" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="text-[0.87rem] text-[var(--tinta-2)] file:mr-[0.6rem] file:px-[0.6rem] file:py-[0.4rem] file:rounded-[var(--r-kecil)] file:border file:border-[var(--garis-kuat)] file:bg-[var(--cekung)] file:cursor-pointer cursor-pointer"
      />
      {data && (
        <button
          type="button"
          onClick={() => setData('')}
          className="block text-[0.8rem] text-[var(--merah)] hover:underline cursor-pointer bg-transparent border-0 p-0"
        >
          Remove image
        </button>
      )}
    </div>
  )
}
