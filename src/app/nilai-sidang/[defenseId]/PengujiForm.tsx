'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import type { BarisNilai, Yudisium } from '@/lib/penilaian/aturan'
import { baris, cekRevisi, formatNilai, nilaiDariSnapshot, parseAngka, SUDAH_DIKIRIM, type Revisi } from '@/lib/penilaian/nilai'
import type { Hasil } from '../actions'

type Props = {
  aspek: { label: string; bobot: number; sub?: string[] }[]
  /** A stored grade (Super Admin edit); an empty form otherwise. */
  awal?: { skor: number[]; adaRevisi: boolean; revisi: Revisi }
  tabel: BarisNilai[]
  /** The Ketua's form: a yudisium is picked and sent with the grade. */
  yudisium?: Yudisium[]
  /** A server action bound to its record; the yudisium is passed only on the Ketua's form. */
  aksi: (skor: string[], adaRevisi: boolean, revisi: Revisi, yudisium: string) => Promise<Hasil>
  tombol: string
  konfirmasi: { judul: string; isi: string; tombol: string }
}

const BTN = 'min-h-[2.4rem] px-[0.9rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer disabled:opacity-60'
const BTN_PRIMER = `${BTN} bg-[var(--biru)] text-white font-medium hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors`
const BTN_SEKUNDER = `${BTN} border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]`
const FIELD = 'w-full px-[0.6rem] py-[0.4rem] rounded-[var(--r-kecil)] border bg-[var(--cekung)] text-[0.93rem]'
const LABEL_KECIL = 'block text-[0.73rem] uppercase tracking-[0.04em] text-[var(--tinta-3)]'
const BARIS_KOSONG = { halaman: '', catatan: '' }

/** A sidang grade: one score per aspek with live total, optional revisi rows, the Ketua's yudisium, then an in-page confirm. */
export function PengujiForm({ aspek, awal, tabel, yudisium, aksi, tombol, konfirmasi }: Props) {
  const [skor, setSkor] = useState<string[]>(() => aspek.map((_, i) => (awal ? String(awal.skor[i]).replace('.', ',') : '')))
  const [adaRevisi, setAdaRevisi] = useState(awal?.adaRevisi ?? false)
  const [revisi, setRevisi] = useState<Revisi>(awal?.revisi.length ? awal.revisi : [BARIS_KOSONG])
  const [pilihan, setPilihan] = useState('')
  const [dicoba, setDicoba] = useState(false)
  const [error, setError] = useState('')
  const [tersimpan, setTersimpan] = useState(false)
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  // Super Admin sees several forms on one page: ids must not collide.
  const uid = useId()

  const parsed = skor.map((s) => parseAngka(s, 0, 100))
  const semuaOk = parsed.every((p) => p.ok)
  const total = semuaOk
    ? nilaiDariSnapshot(aspek.map((a, i) => ({ label: a.label, bobot: a.bobot, skor: (parsed[i] as { value: number }).value })))
    : null
  const cekRev = cekRevisi(adaRevisi, revisi)
  const yudisiumKurang = !!yudisium && !pilihan

  const ubah = () => setTersimpan(false)
  const ubahBaris = (i: number, kolom: 'halaman' | 'catatan', v: string) => {
    ubah()
    setRevisi((rs) => rs.map((r, j) => (j === i ? { ...r, [kolom]: v } : r)))
  }

  function ajukan(e: React.FormEvent) {
    e.preventDefault()
    setDicoba(true)
    setError('')
    if (semuaOk && !('error' in cekRev) && !yudisiumKurang) dialog.current?.showModal()
  }

  function kirim() {
    startTransition(async () => {
      let hasil: Hasil
      try {
        hasil = await aksi(skor, adaRevisi, adaRevisi ? revisi : [], pilihan)
      } catch {
        // Network or server failure: nothing was saved, so the form stays for another try.
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
                    ubah()
                    setSkor((s) => s.map((v, j) => (j === i ? e.target.value : v)))
                  }}
                  aria-invalid={!!salah}
                  aria-describedby={salah ? `${id}-err` : undefined}
                  className={`mono ${FIELD} text-[1rem] text-right ${salah ? 'border-[var(--merah)]' : 'border-[var(--garis-kuat)]'}`}
                />
                {salah && <p id={`${id}-err`} className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">{salah}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      <fieldset className="m-0 mt-[1rem] p-[0.9rem] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] bg-[var(--lembar)]">
        <legend className="sr-only">Revisi</legend>
        <label className="inline-flex items-center gap-[0.5rem] text-[0.93rem] font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={adaRevisi}
            onChange={(e) => {
              ubah()
              setAdaRevisi(e.target.checked)
              if (e.target.checked && revisi.length === 0) setRevisi([BARIS_KOSONG])
            }}
            className="w-[1rem] h-[1rem]"
          />
          Ada revisi
        </label>
        {adaRevisi && (
          <div className="mt-[0.8rem]">
            <ol className="m-0 p-0 list-none flex flex-col gap-[0.8rem]">
              {revisi.map((r, i) => {
                const salah = dicoba && !r.catatan.trim()
                const id = `${uid}-rev-${i}`
                return (
                  <li key={i} className="flex flex-col sm:flex-row gap-[0.6rem] sm:items-start">
                    <div className="sm:w-[7rem] shrink-0">
                      <label htmlFor={`${id}-hal`} className={LABEL_KECIL}>Halaman</label>
                      <input
                        id={`${id}-hal`}
                        autoComplete="off"
                        maxLength={50}
                        value={r.halaman}
                        onChange={(e) => ubahBaris(i, 'halaman', e.target.value)}
                        className={`${FIELD} border-[var(--garis-kuat)]`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label htmlFor={`${id}-cat`} className={LABEL_KECIL}>Catatan revisi {i + 1}</label>
                      <textarea
                        id={`${id}-cat`}
                        rows={2}
                        maxLength={2000}
                        value={r.catatan}
                        onChange={(e) => ubahBaris(i, 'catatan', e.target.value)}
                        aria-invalid={salah}
                        aria-describedby={salah ? `${id}-err` : undefined}
                        className={`${FIELD} resize-y ${salah ? 'border-[var(--merah)]' : 'border-[var(--garis-kuat)]'}`}
                      />
                      {salah && <p id={`${id}-err`} className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">Wajib diisi</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        ubah()
                        setRevisi((rs) => rs.filter((_, j) => j !== i))
                      }}
                      aria-label={`Hapus revisi ${i + 1}`}
                      className={`${BTN_SEKUNDER} sm:mt-[1.1rem] self-start`}
                    >
                      Hapus
                    </button>
                  </li>
                )
              })}
            </ol>
            {dicoba && revisi.length === 0 && (
              <p className="m-0 mt-[0.4rem] text-[0.8rem] text-[var(--merah-teks)]">Tambahkan minimal satu baris revisi, atau matikan &quot;Ada revisi&quot;.</p>
            )}
            <button
              type="button"
              onClick={() => {
                ubah()
                setRevisi((rs) => [...rs, BARIS_KOSONG])
              }}
              className={`${BTN_SEKUNDER} mt-[0.8rem]`}
            >
              Tambah baris revisi
            </button>
          </div>
        )}
      </fieldset>

      {yudisium && (
        <div className="mt-[1rem]">
          <label htmlFor={`${uid}-yud`} className={`${LABEL_KECIL} mb-[0.3rem]`}>Yudisium</label>
          <Select
            id={`${uid}-yud`}
            value={pilihan || undefined}
            onValueChange={(v) => {
              ubah()
              setPilihan(v)
            }}
            placeholder="Pilih yudisium"
            options={yudisium.map((y) => ({ value: y.label, label: y.label }))}
            className={`min-w-[14rem] bg-[var(--cekung)] border rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem] ${dicoba && yudisiumKurang ? 'border-[var(--merah)]' : 'border-[var(--garis-kuat)]'}`}
          />
          {dicoba && yudisiumKurang && <p className="m-0 mt-[0.25rem] text-[0.8rem] text-[var(--merah-teks)]">Pilih yudisium</p>}
        </div>
      )}

      <div className="mt-[1rem] flex flex-wrap items-center gap-[1rem]">
        <div aria-live="polite">
          <span className={LABEL_KECIL}>Nilai</span>
          <span className="mono text-[1.87rem] font-semibold leading-none">
            {total === null ? '—' : `${formatNilai(total)} · ${baris(total, tabel).huruf}`}
          </span>
        </div>
        <button type="submit" disabled={pending} className={`${BTN_PRIMER} ml-auto`}>
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
        <dl className="m-0 mb-[1rem] text-[0.93rem] grid grid-cols-[auto_1fr] gap-x-[0.6rem] gap-y-[0.2rem]">
          {total !== null && (
            <>
              <dt>Nilai</dt>
              <dd className="m-0 mono font-semibold">{formatNilai(total)} · {baris(total, tabel).huruf}</dd>
            </>
          )}
          <dt>Revisi</dt>
          <dd className="m-0">{adaRevisi ? `${revisi.length} baris` : 'Tidak ada'}</dd>
          {yudisium && (
            <>
              <dt>Yudisium</dt>
              <dd className="m-0 font-semibold">{pilihan}</dd>
            </>
          )}
        </dl>
        <div className="flex gap-[0.6rem] justify-end">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className={BTN_SEKUNDER}>
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
