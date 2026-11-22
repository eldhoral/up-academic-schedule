/**
 * Filter and sort for the recap tables (Hasil Prasidang, Nilai Sidang, Nilai Bimbingan, Nilai Akhir), read from the
 * URL and applied on the server: the search and the tanggal/NPM/nama sorts go into the SQL query, the computed values
 * (grades, hasil, status) are sorted and filtered after they are computed. Nothing is filtered in the browser.
 */
export type Arah = 'asc' | 'desc'
export type FilterRekap<U extends string = string, S extends string = string> = { q: string; urut: U; arah: Arah; status: S | '' }
type Params = Record<string, string | string[] | undefined>

const satu = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

/** Search text safe inside a PostgREST or() filter: letters, digits, space, . ' - only, at most 60 characters. */
export function cariAman(q: string): string {
  return q.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** The URL's filter; an unknown urut or status falls back to the first urut and no status filter. */
export function bacaFilter<U extends string, S extends string>(
  sp: Params, opsi: { urut: readonly U[]; status: readonly S[] },
): FilterRekap<U, S> {
  const urut = opsi.urut.find((u) => u === satu(sp.urut)) ?? opsi.urut[0]
  const status = opsi.status.find((s) => s === satu(sp.status)) ?? ''
  return { q: cariAman(satu(sp.q)), urut, arah: satu(sp.arah) === 'desc' ? 'desc' : 'asc', status }
}

/** The or() filter matching NPM or nama on defenses; q must come from cariAman. */
export const cariMahasiswa = (q: string) => `npm.ilike."%${q}%",nama_mahasiswa.ilike."%${q}%"`

/** A copy sorted by key; nulls last either way, ties keep the incoming (SQL) order. */
export function urutkan<T>(rows: T[], key: (r: T) => string | number | null, arah: Arah): T[] {
  const k = arah === 'desc' ? -1 : 1
  return rows
    .map((r, i) => ({ r, i, v: key(r) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v), 'id')
      return c * k || a.i - b.i
    })
    .map((x) => x.r)
}

/** path?params, empty values dropped. */
export function hrefRekap(path: string, params: Record<string, string>): string {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return q.size ? `${path}?${q}` : path
}

const URUT_SQL = ['tanggal', 'npm', 'nama'] as const
type UrutSql = (typeof URUT_SQL)[number]
export const urutSql = (u: string): u is UrutSql => (URUT_SQL as readonly string[]).includes(u)

/** What the SQL query takes: the search, and the sort when it is a defenses column. */
export function cariSql(f: FilterRekap): { q: string; urut?: UrutSql; arah?: Arah } {
  return urutSql(f.urut) ? { q: f.q, urut: f.urut, arah: f.arah } : { q: f.q }
}

/** A sortable column header: its link (keeps search and status, flips the active column) and aria-sort. */
export function kolomUrut(path: string, ay: string, f: FilterRekap, key: string): { href: string; sort?: 'ascending' | 'descending' } {
  const aktif = f.urut === key
  const arah = aktif && f.arah === 'asc' ? 'desc' : 'asc'
  return {
    href: hrefRekap(path, { ay, q: f.q, status: f.status, urut: key, arah }),
    sort: aktif ? (f.arah === 'asc' ? 'ascending' : 'descending') : undefined,
  }
}
