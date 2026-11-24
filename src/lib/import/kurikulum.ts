/** Guards course imports against overwriting a kode_mk that belongs to another kurikulum. */

export type KurikulumRow = { kode_mk: string; kurikulum: string; prodi: string }

/** The kurikulum currently owning each kode_mk within one prodi. */
export function pemilikKurikulum(rows: Iterable<KurikulumRow>, prodi: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of rows) {
    if (r.prodi === prodi) out.set(String(r.kode_mk), String(r.kurikulum ?? ''))
  }
  return out
}

/** A reason to reject the row, or null when the kode is new or already in this kurikulum. */
export function alasanKurikulumBentrok(pemilik: Map<string, string>, kode: string, kurikulum: string): string | null {
  const owner = pemilik.get(String(kode))
  return owner && owner !== String(kurikulum) ? `"${kode}" sudah terdaftar di kurikulum ${owner}.` : null
}
