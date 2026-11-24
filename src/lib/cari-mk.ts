/** Pencarian untuk dropdown Mata Kuliah: kode, sebagian nama, atau inisial nama. */

export type MkCarian = { kode: string; nama: string }

function bersih(s: string): string {
  return s.trim().toLowerCase()
}

function cocokInisial(nama: string, query: string): boolean {
  const kata = bersih(nama)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  let i = 0
  for (const w of kata) {
    if (i >= query.length) return true
    if (w[0] === query[i]) i++
  }
  return i === query.length
}

export function cocokCariMk(mk: MkCarian, query: string): boolean {
  const q = bersih(query)
  if (!q) return true
  if (bersih(mk.kode).includes(q) || bersih(mk.nama).includes(q)) return true
  return cocokInisial(mk.nama, q)
}

/** Kode yang diketik/ditempel persis (di luar itu, pengguna pilih dari daftar). */
export function kodeMkPersis(daftar: MkCarian[], query: string): string | null {
  const q = bersih(query)
  if (!q) return null
  return daftar.find((mk) => bersih(mk.kode) === q)?.kode ?? null
}
