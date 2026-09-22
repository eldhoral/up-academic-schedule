export type GeneratedSlot = {
  sesi_ke: number
  jam_mulai: string // HH:MM
  jam_selesai: string // HH:MM
  sks: number
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10))
  return h * 60 + (m || 0)
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Fills a day with back-to-back session slots from a start time and an SKS
 * pattern, skipping the midday break. Pure function — no DB, no settings
 * lookup — so it is testable and the caller decides where its inputs come from.
 */
export function generateDaySessions(params: {
  startJam: string // HH:MM
  pattern: number[] // SKS per successive slot
  jedaMenit: number
  menitPerSks: number
  istirahatMulai?: string // HH:MM, optional — skip the check if omitted
  istirahatSelesai?: string
  startSesiKe?: number
}): GeneratedSlot[] {
  const { startJam, pattern, jedaMenit, menitPerSks } = params
  const istirahatMulai = params.istirahatMulai ? toMinutes(params.istirahatMulai) : null
  const istirahatSelesai = params.istirahatSelesai ? toMinutes(params.istirahatSelesai) : null

  let cursor = toMinutes(startJam)
  const slots: GeneratedSlot[] = []

  pattern.forEach((sks, i) => {
    let start = cursor
    let end = start + sks * menitPerSks

    if (istirahatMulai !== null && istirahatSelesai !== null && overlaps(start, end, istirahatMulai, istirahatSelesai)) {
      start = istirahatSelesai
      end = start + sks * menitPerSks
    }

    slots.push({
      sesi_ke: (params.startSesiKe ?? 1) + i,
      jam_mulai: toHHMM(start),
      jam_selesai: toHHMM(end),
      sks,
    })

    cursor = end + jedaMenit
  })

  return slots
}
