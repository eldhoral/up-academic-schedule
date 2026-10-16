'use client'

import { useState, useTransition } from 'react'

/** Click-to-arm delete button, shared by every list/modal delete action in the app.
 *  If onConfirm resolves to `{ error }` (every delete action's FormState), the message is shown
 *  under the button and onDeleted is skipped, so a row still in use never fails silently. */
export function ConfirmDeleteButton({
  onConfirm,
  onDeleted,
}: {
  onConfirm: () => Promise<unknown>
  onDeleted?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="min-w-0">
      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setConfirming(true)
          }}
          className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
        >
          Hapus
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await onConfirm()
              if (res && typeof res === 'object' && 'error' in res) {
                setError(String(res.error))
                setConfirming(false)
                return
              }
              onDeleted?.()
            })
          }
          className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer disabled:opacity-60 disabled:cursor-default"
        >
          {isPending ? 'Menghapus…' : 'Konfirmasi hapus?'}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-[0.3rem] max-w-[22rem] text-left text-[0.8rem] leading-[1.4] text-[var(--merah-teks)]">
          {error}
        </p>
      )}
    </div>
  )
}
