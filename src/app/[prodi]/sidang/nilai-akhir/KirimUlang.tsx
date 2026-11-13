'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { kirimUlangEmailAction } from '@/app/nilai-sidang/actions'

/** Super Admin: retry the revisi email of one sidang. The recap refreshes with the new status. */
export function KirimUlang({ defenseId }: { defenseId: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function kirim() {
    setError('')
    startTransition(async () => {
      let hasil: Awaited<ReturnType<typeof kirimUlangEmailAction>>
      try {
        hasil = await kirimUlangEmailAction(defenseId)
      } catch {
        hasil = { error: 'Tidak dapat mengirim. Periksa koneksi lalu coba lagi.' }
      }
      if ('error' in hasil) setError(hasil.error)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={kirim}
        disabled={pending}
        className="block mt-[0.2rem] min-h-[2rem] px-[0.6rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[0.8rem] cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors disabled:opacity-60"
      >
        {pending ? 'Mengirim…' : 'Kirim ulang email'}
      </button>
      {error && <span role="alert" className="block max-w-[14rem] text-[0.73rem] text-[var(--merah-teks)]">{error}</span>}
    </>
  )
}
