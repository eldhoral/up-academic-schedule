import Link from 'next/link'
import type { ReactNode } from 'react'

// Shared pieces of the on-screen previews (Cetak Jadwal, Rekap Dosen): the
// ledger table, the section band, and the "what else goes in the file" panel.

export type Align = 'left' | 'center'

/** Body-cell classes, same `.27rem .53rem` rhythm as the Penjadwalan table. */
export const cell = (align: Align = 'left') =>
  `px-[0.53rem] py-[0.27rem] text-[0.93rem] ${align === 'center' ? 'text-center' : 'text-left'}`

export function PreviewTable({ label, columns, children }: { label: string; columns: { label: string; align?: Align }[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]">
      <table className="w-full border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="bg-[var(--cekung)]">
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`px-[0.53rem] py-[0.4rem] text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)] whitespace-nowrap ${c.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** A full-width group row ("KELAS A", "Kelas Reguler") inside a PreviewTable body. */
export function BandRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr>
      <th
        colSpan={span}
        scope="colgroup"
        className="px-[0.53rem] py-[0.33rem] text-left text-[0.8rem] font-semibold text-[var(--tinta-2)] bg-[var(--cekung)] border-t border-[var(--garis-kuat)]"
      >
        {children}
      </th>
    </tr>
  )
}

/** Main column + the DocFacts panel beside it (below it on narrow screens). */
export function PreviewLayout({ main, panel }: { main: ReactNode; panel: ReactNode }) {
  return (
    <div className="flex-1 grid items-start gap-[1rem] px-[1.3rem] py-[1rem] lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 flex flex-col gap-[1.2rem]">{main}</div>
      {panel}
    </div>
  )
}

/** The settings-driven parts of the file that aren't rows (zoom, keterangan, signer...). */
export function DocFacts({ title, items }: { title: string; items: { label: string; value: string | string[] }[] }) {
  return (
    <aside
      aria-label={title}
      className="bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[0.8rem] lg:sticky lg:top-[1rem]"
    >
      <h2 className="m-0 mb-[0.67rem] text-[0.93rem] font-semibold text-[var(--tinta)]">{title}</h2>
      <dl className="m-0">
        {items.map(({ label, value }) => {
          const lines = (Array.isArray(value) ? value : [value]).filter(Boolean)
          return (
            <div key={label} className="mb-[0.67rem]">
              <dt className="text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">{label}</dt>
              <dd className="m-0 text-[0.87rem] text-[var(--tinta-2)] text-pretty">
                {lines.length === 0 ? <span className="text-[var(--tinta-3)]">—</span> : lines.map((l, i) => <div key={i}>{l}</div>)}
              </dd>
            </div>
          )
        })}
      </dl>
      <Link href="/pengaturan" className="text-[0.87rem]">
        Ubah di Pengaturan
      </Link>
    </aside>
  )
}
