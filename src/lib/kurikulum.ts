/** Normalisasi nilai kurikulum: string dipisah koma, array dibersihkan, duplikat dan blank dibuang. */

export function sebagaiDaftar(v: unknown): string[] {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  return [...new Set(items.map((x) => String(x).trim()).filter(Boolean))]
}

/** Semua kurikulum dari baris-baris, unik dan terurut terbaru lebih dulu. */
export function daftarKurikulum(rows: { kurikulum: unknown }[]): string[] {
  return [...new Set(rows.flatMap((r) => sebagaiDaftar(r.kurikulum)))].sort((x, y) => y.localeCompare(x))
}

/** Gabungan dua nilai kurikulum, unik dan terurut terbaru lebih dulu. */
export function gabungKurikulum(a: unknown, b: unknown): string[] {
  return [...new Set([...sebagaiDaftar(a), ...sebagaiDaftar(b)])].sort((x, y) => y.localeCompare(x))
}

/** Sama jika kedua nilai memuat kurikulum yang sama, abaikan urutan. */
export function samaKurikulum(a: unknown, b: unknown): boolean {
  const x = sebagaiDaftar(a)
  const y = sebagaiDaftar(b)
  return x.length === y.length && x.every((v) => y.includes(v))
}
