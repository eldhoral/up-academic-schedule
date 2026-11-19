'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { linkClass, type Tab } from './nav-sections'

/**
 * A header tab that opens a short list of links (the S1 grading pages). The button shows the current page's
 * label when it is one of the items. Escape, a click outside, or following a link closes it.
 */
export function NavDropdown({ label, items, current }: { label: string; items: Tab[]; current: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const aktif = items.find((t) => t.href === current)

  useEffect(() => {
    if (!open) return
    const luar = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', luar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', luar)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`${linkClass(!!aktif)} inline-flex items-center gap-[0.3rem] cursor-pointer`}
      >
        {aktif?.label ?? label}
        <span aria-hidden="true" className={`text-[0.7rem] transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <ul
          id={id}
          className="absolute left-0 top-full mt-[0.25rem] z-30 min-w-[14rem] m-0 p-[0.3rem] list-none bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]"
        >
          {items.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={t.href === current ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`${linkClass(t.href === current)} whitespace-nowrap`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
