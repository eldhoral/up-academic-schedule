'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Pertanyaan } from '@/lib/penilaian/aturan'
import { HASIL, HASIL_LABEL, MAKS_CATATAN, MAKS_URAIAN, SUDAH_DIKIRIM_BA, type Hasil } from '@/lib/penilaian/prasidang'
import type { HasilAksi } from '../actions'

type Props = {
  pertanyaan: Pertanyaan[]
  /** The server action bound to its record, peran and the displayed question list. */
  aksi: (ya: (boolean | null)[], catatan: string[], hasil: Hasil) => Promise<HasilAksi>
}

const BTN = 'min-h-[2.4rem] px-[0.9rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer disabled:opacity-60'
const RADIO = 'inline-flex items-center gap-[0.4rem] text-[0.93rem] cursor-pointer'

/** Per question Ya/Tidak + catatan, or a required uraian; then the verdict; then an in-page confirm before the action runs. */
export function BeritaAcaraForm({ pertanyaan, aksi }: Props) {
  const [ya, setYa] = useState<(boolean | null)[]>(() => pertanyaan.map(() => null))
  const [catatan, setCatatan] = useState<string[]>(() => pertanyaan.map(() => ''))
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [dicoba, setDicoba] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const uid = useId()

  const kosong = (i: number) => (pertanyaan[i].jenis === 'uraian' ? !catatan[i].trim() : ya[i] === null)
  const lengkap = pertanyaan.every((_, i) => !kosong(i)) && hasil !== null

  function ajukan(e: React.FormEvent) {
    e.preventDefault()
    setDicoba(true)
    setError('')
    if (lengkap) dialog.current?.showModal()
  }

  function kirim() {
    if (!hasil) return
    startTransition(async () => {
      let r: HasilAksi
      try {
        r = await aksi(ya, catatan, hasil)
      } catch {
        r = { error: 'Tidak dapat menyimpan. Periksa koneksi lalu coba lagi.' }
      }
      dialog.current?.close()
      if ('error' in r) {
        setError(r.error)
        if (r.error === SUDAH_DIKIRIM_BA) router.refresh()
      } else router.refresh()
    })
  }

  return (
    <form onSubmit={ajukan} noValidate>
      <ol className="m-0 p-0 list-none border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)] divide-y divide-[var(--garis)]">
        {pertanyaan.map((q, i) => {
          const salah = dicoba && kosong(i)
          const id = `${uid}-q-${i}`
          const ubahCatatan = (e: React.ChangeEvent<HTMLTextAreaElement>) => setCatatan((s) => s.map((x, j) => (j === i ? e.target.value : x)))
          const wajib = <span className="text-[var(--merah-teks)]" aria-hidden="true">*</span>
          const pesan = salah && <p id={`${id}-err`} className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">Wajib {q.jenis === 'uraian' ? 'diisi' : 'dijawab'}</p>
          if (q.jenis === 'uraian') {
            return (
              <li key={i} className="p-[0.9rem]">
                <label htmlFor={`${id}-c`} className="block text-[0.93rem] font-medium">{q.teks} {wajib}</label>
                <textarea
                  id={`${id}-c`}
                  rows={3}
                  maxLength={MAKS_URAIAN}
                  required
                  aria-invalid={!!salah}
                  aria-describedby={salah ? `${id}-err` : undefined}
                  value={catatan[i]}
                  onChange={ubahCatatan}
                  className={`mt-[0.4rem] w-full px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] border bg-[var(--cekung)] text-[0.93rem] ${salah ? 'border-[var(--merah)]' : 'border-[var(--garis-kuat)]'}`}
                />
                {pesan}
              </li>
            )
          }
          return (
            <li key={i} className="p-[0.9rem]">
              <fieldset className="m-0 p-0 border-0" aria-describedby={salah ? `${id}-err` : undefined}>
                <legend className="text-[0.93rem] font-medium">{q.teks} {wajib}</legend>
                <div className="mt-[0.5rem] flex gap-[1.2rem]">
                  {([true, false] as const).map((v) => (
                    <label key={String(v)} className={RADIO}>
                      <input type="radio" name={id} checked={ya[i] === v} onChange={() => setYa((s) => s.map((x, j) => (j === i ? v : x)))} />
                      {v ? 'Ya' : 'Tidak'}
                    </label>
                  ))}
                </div>
                {pesan}
              </fieldset>
              <label htmlFor={`${id}-c`} className="block mt-[0.7rem] text-[0.8rem] text-[var(--tinta-3)]">Catatan prasidang</label>
              <textarea
                id={`${id}-c`}
                rows={2}
                maxLength={MAKS_CATATAN}
                value={catatan[i]}
                onChange={ubahCatatan}
                className="mt-[0.25rem] w-full px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[0.93rem]"
              />
            </li>
          )
        })}
      </ol>

      <fieldset className="mt-[1.2rem] m-0 p-[0.9rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)]">
        <legend className="px-[0.3rem] text-[0.93rem] font-semibold">
          Hasil prasidang <span className="text-[var(--merah-teks)]" aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-col gap-[0.5rem]">
          {HASIL.map((h) => (
            <label key={h} className={RADIO}>
              <input type="radio" name={`${uid}-hasil`} checked={hasil === h} onChange={() => setHasil(h)} />
              {HASIL_LABEL[h]}
            </label>
          ))}
        </div>
        {dicoba && !hasil && <p className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">Pilih hasil prasidang</p>}
      </fieldset>

      <div className="mt-[1rem] flex">
        <button type="submit" disabled={pending} className={`${BTN} ml-auto bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`}>
          Kirim berita acara
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-[0.8rem] m-0 bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)]">
          {error}
        </p>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-judul`}
        className="m-auto w-[calc(100%-2rem)] max-w-[26rem] bg-[var(--lembar)] text-[var(--tinta)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem] backdrop:bg-black/40"
      >
        <h2 id={`${uid}-judul`} className="m-0 mb-[0.5rem] text-[1.1rem] font-semibold">Kirim berita acara?</h2>
        <p className="m-0 mb-[0.4rem] text-[0.93rem] text-[var(--tinta-2)]">Setelah dikirim, berita acara tidak bisa diubah.</p>
        {hasil && <p className="m-0 mb-[1rem] text-[0.93rem] font-medium">{HASIL_LABEL[hasil]}</p>}
        <div className="flex gap-[0.6rem] justify-end">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className={`${BTN} border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]`}>
            Batal
          </button>
          <button type="button" disabled={pending} onClick={kirim} className={`${BTN} bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`}>
            {pending ? 'Menyimpan…' : 'Kirim berita acara'}
          </button>
        </div>
      </dialog>
    </form>
  )
}
