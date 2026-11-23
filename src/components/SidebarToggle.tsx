'use client'

import { useEffect, useId, useRef, useState } from 'react'

/** Phone-only menu button; the server-rendered Sidebar arrives as children. */
export function SidebarToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open])

  const tutup = () => {
    setOpen(false)
    button.current?.focus()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="Buka menu utama"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="md:hidden flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 cursor-pointer items-center justify-center rounded-[var(--r-item)] border border-[var(--garis)] bg-transparent text-[var(--tinta)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="h-[1.2rem] w-[1.2rem]">
          {open ? <><path d="M5 5l14 14" /><path d="M19 5 5 19" /></> : <><path d="M4 7h16M4 12h16M4 17h16" /></>}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Tutup menu utama" onClick={tutup} className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/40" />
          {/* Following a link closes the overlay; focus is not pulled back because the page is navigating. */}
          <div
            id={id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false)
            }}
            className="absolute left-0 top-0 h-full max-w-[calc(100vw-3rem)] shadow-xl"
          >
            {children}
          </div>
        </div>
      )}
    </>
  )
}
