import { useEffect, useEffectEvent } from 'react'

// Open dialogs, oldest first: only the topmost one answers Escape (HapusPaksa over DefenseFormModal).
const tumpukan: symbol[] = []

/**
 * Escape closes the dialog. Skipped while `nonaktif` (a save in flight) and when something inside
 * already used this Escape: a Radix `Select` popup and `CariSelect` call `preventDefault()` when they close.
 */
export function useEscape(tutup: () => void, nonaktif = false) {
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (nonaktif || e.defaultPrevented) return
    e.preventDefault()
    tutup()
  })

  useEffect(() => {
    const id = Symbol()
    tumpukan.push(id)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tumpukan.at(-1) === id) onEscape(e)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      tumpukan.splice(tumpukan.indexOf(id), 1)
    }
  }, [])
}

/** For a dialog written inline behind `{open && …}`, where a hook can't be called: render this inside it. */
export function TutupDenganEscape({ tutup, nonaktif }: { tutup: () => void; nonaktif?: boolean }) {
  useEscape(tutup, nonaktif)
  return null
}
