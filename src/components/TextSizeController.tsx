'use client'

import { useEffect, useState } from 'react'

type TextSize = 'kecil' | 'sedang' | 'besar'

export function TextSizeController() {
  const [size, setSize] = useState<TextSize>('kecil')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('krs-teks') as TextSize | null
      if (saved && (saved === 'kecil' || saved === 'sedang' || saved === 'besar')) {
        applySize(saved)
      }
    } catch {
      // localStorage may be disabled
    }
  }, [])

  function applySize(newSize: TextSize) {
    setSize(newSize)
    const root = document.documentElement
    if (newSize === 'kecil') {
      root.removeAttribute('data-teks')
    } else {
      root.setAttribute('data-teks', newSize)
    }
    try {
      localStorage.setItem('krs-teks', newSize)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-[0.4rem] text-[0.8rem] text-[var(--tinta-2)]">
      <span>Text size</span>
      <div
        role="group"
        aria-label="Text size"
        className="flex border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] overflow-hidden bg-[var(--lembar)]"
      >
        <button
          type="button"
          onClick={() => applySize('kecil')}
          aria-pressed={size === 'kecil'}
          className={`min-w-[2.4rem] min-h-[2.4rem] border-0 cursor-pointer text-[var(--tinta-2)] transition-colors duration-150 flex items-center justify-center font-normal ${
            size === 'kecil'
              ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-semibold'
              : 'hover:bg-[var(--cekung)]'
          }`}
          style={{ fontSize: '0.87rem' }}
          title="Small text size (15px)"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => applySize('sedang')}
          aria-pressed={size === 'sedang'}
          className={`min-w-[2.4rem] min-h-[2.4rem] border-0 border-l border-[var(--garis)] cursor-pointer text-[var(--tinta-2)] transition-colors duration-150 flex items-center justify-center font-normal ${
            size === 'sedang'
              ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-semibold'
              : 'hover:bg-[var(--cekung)]'
          }`}
          style={{ fontSize: '1.07rem' }}
          title="Medium text size (17px)"
        >
          A
        </button>
        <button
          type="button"
          onClick={() => applySize('besar')}
          aria-pressed={size === 'besar'}
          className={`min-w-[2.4rem] min-h-[2.4rem] border-0 border-l border-[var(--garis)] cursor-pointer text-[var(--tinta-2)] transition-colors duration-150 flex items-center justify-center font-normal ${
            size === 'besar'
              ? 'bg-[var(--biru-lembut)] text-[var(--biru)] font-semibold'
              : 'hover:bg-[var(--cekung)]'
          }`}
          style={{ fontSize: '1.27rem' }}
          title="Large text size (19px)"
        >
          A
        </button>
      </div>
    </div>
  )
}
