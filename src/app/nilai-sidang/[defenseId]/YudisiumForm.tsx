'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { Select } from '@/components/Select'
import type { Yudisium } from '@/lib/penilaian/aturan'
import type { Hasil } from '../actions'

const BTN = 'min-h-[2.4rem] px-[0.9rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer disabled:opacity-60'
const BTN_PRIMER = `${BTN} bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`

/** Super Admin: pick a yudisium (lock an old sidang, or change a locked one's), then an in-page confirm. */
export function YudisiumForm({ pilihan, awal, aksi, tombol, konfirmasi }: {
  pilihan: Yudisium[]
  awal?: string
  aksi: (yudisium: string) => Promise<Hasil>
  tombol: string
  konfirmasi: { judul: string; isi: string; tombol: string }
}) {
  // A stored label no longer among the choices shows as unpicked.
  const [nilai, setNilai] = useState(pilihan.some((p) => p.label === awal) ? awal! : '')
  const [error, setError] = useState('')
  const [tersimpan, setTersimpan] = useState(false)
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const uid = useId()

  function kirim() {
    startTransition(async () => {
      let hasil: Hasil
      try {
        hasil = await aksi(nilai)
      } catch {
        hasil = { error: 'Tidak dapat menyimpan. Periksa koneksi lalu coba lagi.' }
      }
      dialog.current?.close()
      if ('error' in hasil) setError(hasil.error)
      else setTersimpan(true)
    })
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setError(nilai ? '' : 'Pilih yudisium.')
        if (nilai) dialog.current?.showModal()
      }}
    >
      <label htmlFor={`${uid}-yud`} className="block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)] mb-[0.3rem]">Yudisium</label>
      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <Select
          id={`${uid}-yud`}
          value={nilai || undefined}
          onValueChange={(v) => {
            setTersimpan(false)
            setNilai(v)
          }}
          placeholder="Pilih yudisium"
          options={pilihan.map((y) => ({ value: y.label, label: y.label }))}
          className="min-w-[14rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />
        <button type="submit" disabled={pending} className={BTN_PRIMER}>{tombol}</button>
      </div>
      {error && (
        <p role="alert" className="mt-[0.8rem] m-0 bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)]">
          {error}
        </p>
      )}
      {tersimpan && <p role="status" className="mt-[0.8rem] m-0 text-[0.87rem] text-[var(--hijau)]">Tersimpan.</p>}

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-judul`}
        className="m-auto w-[calc(100%-2rem)] max-w-[26rem] bg-[var(--lembar)] text-[var(--tinta)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem] backdrop:bg-black/40"
      >
        <h2 id={`${uid}-judul`} className="m-0 mb-[0.5rem] text-[1.1rem] font-semibold">{konfirmasi.judul}</h2>
        <p className="m-0 mb-[0.4rem] text-[0.93rem] text-[var(--tinta-2)]">{konfirmasi.isi}</p>
        <p className="m-0 mb-[1rem] text-[0.93rem]">Yudisium: <span className="font-semibold">{nilai}</span></p>
        <div className="flex gap-[0.6rem] justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.close()}
            className={`${BTN} border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]`}
          >
            Batal
          </button>
          <button type="button" disabled={pending} onClick={kirim} className={BTN_PRIMER}>
            {pending ? 'Menyimpan…' : konfirmasi.tombol}
          </button>
        </div>
      </dialog>
    </form>
  )
}
