'use client'

import { useActionState, useEffect, useState } from 'react'
import { Select } from '@/components/Select'
import { HARI_DB as HARI } from '@/lib/hari'
import { createClient } from '@/lib/supabase/client'
import { humanDbError } from '@/lib/db-error'
import { saveSettingsAction, type FormState } from './actions'

const FOTO_LOGIN_BUCKET = 'up_kiprat'
const FOTO_LOGIN_PREFIX = 'login'
const FOTO_LOGIN_MAX_BYTES = 1024 * 1024

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
          Pengaturan berhasil disimpan.
        </div>
      )}

      {settings.length === 0 && (
        <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem] text-center text-[0.93rem] text-[var(--tinta-3)]">
          Belum ada pengaturan. Jalankan seed migration untuk mengisi kunci bawaan.
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

      <FotoLoginSection />

      <button
        type="submit"
        disabled={isPending || settings.length === 0}
        className="px-[1rem] py-[0.6rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.93rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Menyimpan…' : 'Simpan pengaturan'}
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
          Hapus gambar
        </button>
      )}
    </div>
  )
}

type FotoLogin = { name: string; url: string }

function FotoLoginSection() {
  const [photos, setPhotos] = useState<FotoLogin[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function fetchPhotos(): Promise<{ photos: FotoLogin[]; error: string }> {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(FOTO_LOGIN_BUCKET)
      .list(FOTO_LOGIN_PREFIX, { sortBy: { column: 'created_at', order: 'asc' } })
    if (error) return { photos: [], error: humanDbError(error) }
    const files = (data ?? []).filter((f) => f.name && !f.name.endsWith('/'))
    return {
      photos: files.map((f) => ({
        name: f.name,
        url: supabase.storage.from(FOTO_LOGIN_BUCKET).getPublicUrl(`${FOTO_LOGIN_PREFIX}/${f.name}`).data.publicUrl,
      })),
      error: '',
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchPhotos().then((result) => {
      if (cancelled) return
      if (result.error) setError(result.error)
      setPhotos(result.photos)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar.')
      return
    }
    if (file.size > FOTO_LOGIN_MAX_BYTES) {
      setError('Ukuran gambar maksimal 1 MB.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${FOTO_LOGIN_PREFIX}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(FOTO_LOGIN_BUCKET).upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(humanDbError(uploadError))
      return
    }
    const result = await fetchPhotos()
    if (result.error) setError(result.error)
    setPhotos(result.photos)
  }

  async function handleDelete(name: string) {
    setError('')
    const supabase = createClient()
    const { error: deleteError } = await supabase.storage.from(FOTO_LOGIN_BUCKET).remove([`${FOTO_LOGIN_PREFIX}/${name}`])
    if (deleteError) {
      setError(humanDbError(deleteError))
      return
    }
    setPhotos((prev) => prev.filter((p) => p.name !== name))
  }

  return (
    <section className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
      <h2 className="m-0 text-[1.07rem] font-semibold mb-[0.3rem]">Foto Halaman Masuk</h2>
      <p className="mt-0 mb-[1rem] text-[0.8rem] text-[var(--tinta-3)] leading-[1.4]">
        Foto yang tampil bergantian di halaman masuk. Maksimal 1 MB per gambar (PNG, JPG, atau WEBP).
      </p>

      {error && (
        <div className="mb-[0.8rem] bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.8rem] text-[var(--merah)]">
          {error}
        </div>
      )}

      {!loading && (
        <div className="flex flex-wrap gap-[0.8rem] mb-[1rem]">
          {photos.map((p) => (
            <div key={p.name} className="relative w-[9rem] h-[6rem] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt=""
                className="w-full h-full object-cover rounded-[var(--r-kecil)] border border-[var(--garis-kuat)]"
              />
              <button
                type="button"
                onClick={() => handleDelete(p.name)}
                className="absolute top-[0.25rem] right-[0.25rem] w-[1.4rem] h-[1.4rem] flex items-center justify-center rounded-full bg-black/60 text-white text-[0.8rem] leading-none cursor-pointer hover:bg-black/80"
                aria-label="Hapus foto"
              >
                &times;
              </button>
            </div>
          ))}
          {photos.length === 0 && <p className="text-[0.87rem] text-[var(--tinta-3)]">Belum ada foto.</p>}
        </div>
      )}

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        disabled={uploading}
        className="text-[0.87rem] text-[var(--tinta-2)] file:mr-[0.6rem] file:px-[0.6rem] file:py-[0.4rem] file:rounded-[var(--r-kecil)] file:border file:border-[var(--garis-kuat)] file:bg-[var(--cekung)] file:cursor-pointer cursor-pointer disabled:opacity-60"
      />
      {uploading && <p className="mt-[0.4rem] text-[0.8rem] text-[var(--tinta-3)]">Mengunggah…</p>}
    </section>
  )
}
