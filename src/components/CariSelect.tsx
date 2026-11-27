'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cocokCariMk, kodeMkPersis } from '@/lib/cari-mk'

export type CariSelectOption = { value: string; label: string; kode: string; nama: string }

/**
 * Dropdown dengan kolom cari, dipakai untuk daftar panjang seperti Mata Kuliah.
 * Pencarian menerima kode mk, sebagian nama, atau inisial nama (lihat cari-mk.ts).
 */
export function CariSelect({
  value,
  onValueChange,
  options,
  placeholder,
  name,
  ariaLabel,
  className = '',
}: {
  value: string
  onValueChange: (value: string) => void
  options: CariSelectOption[]
  placeholder?: string
  name?: string
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const items = useMemo(
    () => options.filter((o) => cocokCariMk({ kode: o.kode, nama: o.nama }, query)),
    [options, query]
  )

  function posisi() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  function buka() {
    setQuery('')
    setActive(0)
    posisi()
    setOpen(true)
  }

  function tutup() {
    setOpen(false)
    setRect(null)
  }

  function pilih(o: CariSelectOption) {
    onValueChange(o.value)
    tutup()
    triggerRef.current?.focus()
  }

  function gantiQuery(next: string) {
    setQuery(next)
    setActive(0)
    // Kode mk yang ditempel persis langsung dipilih.
    const pas = kodeMkPersis(options, next)
    if (pas) pilih(options.find((o) => o.value === pas)!)
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (open) posisi()
    function onScrollOrResize() {
      if (open) posisi()
    }
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return
      tutup()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault() // this Escape closed the list; the dialog around it stays open (useEscape)
        tutup()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) pilih(items[active])
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? tutup() : buka())}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex items-center justify-between gap-[0.4rem] cursor-pointer data-[placeholder]:text-[var(--tinta-3)] ${className}`}
        data-placeholder={selected ? undefined : ''}
      >
        <span className="min-w-0 truncate text-left">{selected ? selected.label : placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="shrink-0 text-[var(--tinta-3)]">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && rect &&
        createPortal(
          <div
            ref={listRef}
            className="fixed z-[70] overflow-hidden bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)]"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => gantiQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Cari kode, nama, atau inisial…"
              aria-label="Cari mata kuliah"
              className="w-full bg-[var(--cekung)] border-b border-[var(--garis-kuat)] px-[0.6rem] py-[0.45rem] text-[0.87rem] outline-none"
            />
            <div role="listbox" aria-label={ariaLabel} className="p-[0.27rem] max-h-[14rem] overflow-y-auto">
              {items.length === 0 ? (
                <p className="m-0 px-[0.6rem] py-[0.4rem] text-[0.87rem] text-[var(--tinta-3)]">Tidak ada yang cocok.</p>
              ) : (
                items.map((o, i) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pilih(o)}
                    className={`block w-full text-left px-[0.6rem] py-[0.33rem] rounded-[var(--r-kecil)] text-[0.93rem] cursor-pointer whitespace-nowrap ${
                      i === active ? 'bg-[var(--cekung)]' : ''
                    } ${o.value === value ? 'text-[var(--biru)] font-medium' : ''}`}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
