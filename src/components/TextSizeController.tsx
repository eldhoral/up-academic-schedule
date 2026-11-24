'use client'

import { useEffect, useState } from 'react'

type TextSize = 'kecil' | 'sedang' | 'besar'

/** `ringkas`: the sidebar footer look (Final-Beranda): label "Teks" and three separate 32px buttons. */
export function TextSizeController({ ringkas = false }: { ringkas?: boolean } = {}) {
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

  if (ringkas) {
    const ukuran: { size: TextSize; font: string; title: string }[] = [
      { size: 'kecil', font: '0.8rem', title: 'Teks kecil (15px)' },
      { size: 'sedang', font: '0.933rem', title: 'Teks sedang (17px)' },
      { size: 'besar', font: '1.067rem', title: 'Teks besar (19px)' },
    ]
    return (
      <div role="group" aria-label="Ukuran teks" className="flex items-center gap-[0.4rem] text-[0.8rem] text-[var(--tinta-3)]">
        Teks
        {ukuran.map((u) => (
          <button
            key={u.size}
            type="button"
            onClick={() => applySize(u.size)}
            aria-pressed={size === u.size}
            title={u.title}
            style={{ fontSize: u.font }}
            className={`min-w-[2.133rem] h-[2.133rem] cursor-pointer rounded-[8px] border border-[var(--garis-kuat)] ${
              size === u.size ? 'bg-[var(--aksen-lembut)] text-[var(--aksen)]' : 'bg-[var(--lembar)] hover:bg-[var(--cekung)]'
            }`}
          >
            A
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-[0.4rem] text-[0.8rem] text-[var(--tinta)]">
      {/* The label is the first thing to go on a phone: the three sizes explain themselves. */}
      <span className="hidden sm:inline whitespace-nowrap">Ukuran teks</span>
      <div
        role="group"
        aria-label="Ukuran teks"
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
          title="Teks kecil (15px)"
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
          title="Teks sedang (17px)"
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
          title="Teks besar (19px)"
        >
          A
        </button>
      </div>
    </div>
  )
}
