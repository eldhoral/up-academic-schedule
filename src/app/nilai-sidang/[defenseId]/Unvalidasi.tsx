'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PeranSidang } from '@/lib/penilaian/akses'
import { unvalidasiNilaiSidangAction, type Hasil } from '../actions'

const BTN = 'min-h-[2.4rem] px-[0.9rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer disabled:opacity-60'

/** The Ketua, before locking: send one Anggota's grade back (its scores stay as a draft) so that examiner validates again. In-page confirm. */
export function Unvalidasi({ defenseId, peran, label, dosen }: { defenseId: string; peran: PeranSidang; label: string; dosen: string }) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const uid = useId()

  function kirim() {
    startTransition(async () => {
      let hasil: Hasil
      try {
        hasil = await unvalidasiNilaiSidangAction(defenseId, peran)
      } catch {
        hasil = { error: 'Tidak dapat menyimpan. Periksa koneksi lalu coba lagi.' }
      }
      dialog.current?.close()
      if ('error' in hasil) setError(hasil.error)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          dialog.current?.showModal()
        }}
        className="mt-[0.6rem] min-h-[2rem] px-[0.6rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[0.8rem] cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors"
      >
        Unvalidasi
      </button>
      {error && <p role="alert" className="m-0 mt-[0.3rem] text-[0.73rem] text-[var(--merah-teks)]">{error}</p>}

      <dialog
        ref={dialog}
        aria-labelledby={`${uid}-judul`}
        className="m-auto w-[calc(100%-2rem)] max-w-[26rem] bg-[var(--lembar)] text-[var(--tinta)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem] backdrop:bg-black/40"
      >
        <h2 id={`${uid}-judul`} className="m-0 mb-[0.5rem] text-[1.1rem] font-semibold">Unvalidasi nilai {label}?</h2>
        <p className="m-0 mb-[1rem] text-[0.93rem] text-[var(--tinta-2)]">
          Nilai dari {dosen} dibuka kembali: isian sebelumnya tetap tersimpan, {label} cukup mengubah yang perlu lalu memvalidasi lagi sebelum sidang dapat dikunci. Tercatat di Log Aktivitas.
        </p>
        <div className="flex gap-[0.6rem] justify-end">
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()} className={`${BTN} border border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]`}>
            Batal
          </button>
          <button type="button" disabled={pending} onClick={kirim} className={`${BTN} bg-[var(--merah)] text-white font-medium active:scale-[0.97] transition-colors`}>
            {pending ? 'Menyimpan…' : 'Unvalidasi'}
          </button>
        </div>
      </dialog>
    </>
  )
}
