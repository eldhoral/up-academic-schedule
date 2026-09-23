'use client'

import { useState, useTransition } from 'react'

/** Click-to-arm delete button, shared by every list/modal delete action in the app. */
export function ConfirmDeleteButton({ onConfirm }: { onConfirm: () => Promise<unknown> }) {
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
      >
        Hapus
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await onConfirm() })}
      className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer disabled:opacity-60 disabled:cursor-default"
    >
      {isPending ? 'Menghapus…' : 'Konfirmasi hapus?'}
    </button>
  )
}
