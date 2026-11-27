/** What uts/uas are called on screen (kiprat 2026-11-27: ETS & EAS). The stored values stay 'uts' / 'uas'. */
export const UJIAN_LABEL = { uts: 'ETS', uas: 'EAS' } as const

export const ujianLabel = (jenis: string): string => UJIAN_LABEL[jenis as keyof typeof UJIAN_LABEL] ?? jenis.toUpperCase()
