'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export function SidebarToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  // Closing plays the exit animation (200ms) before the drawer unmounts.
  const [closing, setClosing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  const tutup = useCallback(() => {
    setClosing(true)
    buttonRef.current?.focus()
    window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 200)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup()
    }
    document.addEventListener('keydown', onKeyDown)
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = origOverflow
    }
  }, [open, tutup])

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('a')) tutup()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Menu navigasi"
        onClick={() => (open ? tutup() : setOpen(true))}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta)] hover:bg-[var(--cekung)] md:hidden cursor-pointer shrink-0"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div id={id} className="fixed inset-0 z-50 md:hidden" onClick={handleClick}>
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs ${closing ? 'latar-tutup' : 'latar-buka'}`}
            aria-hidden="true"
            onClick={tutup}
          />
          <div className={`fixed inset-y-0 left-0 w-[16rem] max-w-[85vw] bg-[var(--sidebar)] shadow-xl z-10 flex flex-col h-full ${closing ? 'laci-tutup' : 'laci-buka'}`}>
            {children}
          </div>
        </div>
      )}
    </>
  )
}
