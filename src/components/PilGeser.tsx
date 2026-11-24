'use client'

import { useLayoutEffect, useRef } from 'react'

/** Where each named highlight was when its page went away. Module state survives client navigation. */
const terakhir = new Map<string, DOMRect>()

/**
 * The active-item highlight of the sidebar or tab bar. On navigation it slides from where the previous
 * page's highlight was (FLIP: measure, invert with a transform, play to rest) instead of jumping.
 */
export function PilGeser({ nama, className }: { nama?: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !nama) return
    const baru = el.getBoundingClientRect()
    const lama = terakhir.get(nama)
    const diam = !lama || (lama.left === baru.left && lama.top === baru.top && lama.width === baru.width)
    if (!diam && baru.width && baru.height && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate(
        [
          {
            transformOrigin: 'top left',
            transform: `translate(${lama.left - baru.left}px, ${lama.top - baru.top}px) scale(${lama.width / baru.width}, ${lama.height / baru.height})`,
          },
          { transformOrigin: 'top left', transform: 'none' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
      )
    }
    // Measured on the way out, so a scrolled sidebar still starts the slide from what the user saw.
    return () => {
      terakhir.set(nama, el.getBoundingClientRect())
    }
  }, [nama])

  return <span ref={ref} aria-hidden="true" className={className} />
}
