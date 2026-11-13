'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BarisNilai } from '@/lib/penilaian/aturan'
import { baris, formatNilai, nilaiDariSnapshot, parseAngka, SUDAH_DIKIRIM } from '@/lib/penilaian/nilai'
import type { Hasil } from '../actions'

type Props = {
  aspek: { label: string; bobot: number; sub?: string[] }[]
  /** Scores already stored (Super Admin edit); empty inputs otherwise. */
  awal?: number[]
  tabel: BarisNilai[]
  /** A server action bound to its record. */
  aksi: (skor: string[]) => Promise<Hasil>
  tombol: string
  konfirmasi: { judul: string; isi: string; tombol: string }
}

const BTN = 'min-h-[2.4rem] px-[0.9rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer disabled:opacity-60'

/** One score per aspek, live total and letter, then an in-page confirm before the action runs. */
export function NilaiForm({ aspek, awal, tabel, aksi, tombol, konfirmasi }: Props) {
  const [skor, setSkor] = useState<string[]>(() => aspek.map((_, i) => (awal ? String(awal[i]).replace('.', ',') : '')))
  const [dicoba, setDicoba] = useState(false)
  const [error, setError] = useState('')
  const [tersimpan, setTersimpan] = useState(false)
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  // Super Admin sees two forms on one page: ids must not collide.
  const uid = useId()

  const parsed = skor.map((s) => parseAngka(s, 0, 100))
  const semuaOk = parsed.every((p) => p.ok)
  const total = semuaOk
    ? nilaiDariSnapshot(aspek.map((a, i) => ({ label: a.label, bobot: a.bobot, skor: (parsed[i] as { value: number }).value })))
    : null

  function ajukan(e: React.FormEvent) {
    e.preventDefault()
    setDicoba(true)
    setError('')
    if (semuaOk) dialog.current?.showModal()
  }

  function kirim() {
    startTransition(async () => {
      let hasil: Hasil
      try {
        hasil = await aksi(skor)
      } catch {
        // Network or server failure: nothing was saved, so the scores stay for another try.
        hasil = { error: 'Tidak dapat menyimpan. Periksa koneksi lalu coba lagi.' }
      }
      dialog.current?.close()
      if ('error' in hasil) {
        setError(hasil.error)
        // Graded in another tab: reload into the read-only view.
        if (hasil.error === SUDAH_DIKIRIM) router.refresh()
      } else setTersimpan(true)
    })
  }

  return (
    <form onSubmit={ajukan} noValidate>
      <ol className="m-0 p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] divide-y divide-[var(--garis)]">
        {aspek.map((a, i) => {
          const p = parsed[i]
          const salah = dicoba && !p.ok ? p.error : ''
          const id = `${uid}-skor-${i}`
          return (
            <li key={i} className="flex flex-col sm:flex-row gap-[0.6rem] sm:gap-[1rem] p-[0.9rem]">
              <div className="flex-1 min-w-0">
                <label htmlFor={id} className="block text-[0.93rem] font-medium">
                  {a.label} <span className="mono text-[0.8rem] font-normal text-[var(--tinta-3)]">{a.bobot}%</span>
                </label>
                {a.sub && a.sub.length > 0 && (
                  <ul className="m-0 mt-[0.3rem] pl-[1.1rem] text-[0.8rem] text-[var(--tinta-3)] list-disc">
                    {a.sub.map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                )}
              </div>
              <div className="sm:w-[7rem] shrink-0">
                <input
                  id={id}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0–100"
                  value={skor[i]}
                  onChange={(e) => {
                    setTersimpan(false)
                    setSkor((s) => s.map((v, j) => (j === i ? e.target.value : v)))
                  }}
                  aria-invalid={!!salah}
                  aria-describedby={salah ? `${id}-err` : undefined}
                  className={`mono w-full px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] border bg-[var(--cekung)] text-[1rem] text-right ${salah ? 'border-[var(--merah)]' : 'border-[var(--garis-kuat)]'}`}
                />
                {salah && <p id={`${id}-err`} className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">{salah}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-[1rem] flex flex-wrap items-center gap-[1rem]">
        <div aria-live="polite">
          <span className="block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]">Nilai</span>
          <span className="mono text-[1.87rem] font-semibold leading-none">
            {total === null ? '—' : `${formatNilai(total)} · ${baris(total, tabel).huruf}`}
          </span>
        </div>
        <button type="submit" disabled={pending} className={`${BTN} ml-auto bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`}>
          {tombol}
        </button>
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
        {total !== null && (
          <p className="m-0 mb-[1rem] text-[0.93rem]">
            Nilai: <span className="mono font-semibold">{formatNilai(total)} · {baris(total, tabel).huruf}</span>
          </p>
        )}
        <div className="flex gap-[0.6rem] justify-end">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className={`${BTN} border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]`}>
            Batal
          </button>
          <button type="button" disabled={pending} onClick={kirim} className={`${BTN} bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`}>
            {pending ? 'Menyimpan…' : konfirmasi.tombol}
          </button>
        </div>
      </dialog>
    </form>
  )
}
