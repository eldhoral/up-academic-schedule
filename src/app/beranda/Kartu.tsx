import Link from 'next/link'
import { ACTION_LABEL, summarize, tableLabel, type AuditRow } from '@/lib/audit-log'
import type { Prodi } from '@/lib/prodi'
import type { SidangDatang } from '../beranda-data'
import type { ScheduleStatus } from '../hub-status'
import { jenisLabel, tanggalSingkat } from '../[prodi]/sidang/defense-types'

/** A module tile: the whole card links to its schedule; Cetak is a separate link. */
export function KartuModul({
  judul,
  href,
  cetakHref,
  status,
  adaTahun,
}: {
  judul: string
  href: string
  cetakHref: string
  status: ScheduleStatus | null
  adaTahun: boolean
}) {
  return (
    <div className="group relative flex min-h-[9rem] flex-col rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1rem] transition-shadow hover:shadow-sm">
      <Link href={href} className="flex flex-1 flex-col no-underline text-[var(--tinta)] after:absolute after:inset-0">
        <span className="pr-[1.5rem] text-[0.88rem] font-medium text-[var(--tinta-2)]">{judul}</span>
        <span aria-hidden="true" className="absolute right-[0.8rem] top-[0.7rem] text-[1.2rem] text-[var(--tinta-3)] transition-transform group-hover:translate-x-[2px] group-hover:text-[var(--aksen)]">
          ›
        </span>
        {!adaTahun ? (
          <span className="mt-auto text-[0.82rem] text-[var(--tinta-3)]">Belum ada tahun akademik</span>
        ) : !status ? (
          <span className="mt-auto text-[0.82rem] text-[var(--tinta-3)]">Status belum bisa dibaca</span>
        ) : status.empty ? (
          <span className="mt-auto text-[0.82rem] text-[var(--tinta-3)]">Belum ada jadwal</span>
        ) : (
          <>
            <span className="mt-[0.6rem] flex items-baseline gap-[0.4rem]">
              <span className="mono text-[1.87rem] leading-none font-semibold tracking-[-0.025em]">{status.figure}</span>
              <span className="text-[0.83rem] text-[var(--tinta-3)]">{status.label}</span>
            </span>
            <span className="mt-[0.3rem] text-[0.78rem] text-[var(--tinta-3)]">{status.detail.join(' · ')}</span>
          </>
        )}
      </Link>
      <div className="mt-[0.6rem] flex items-end justify-between gap-[0.5rem]">
        {adaTahun && status && !status.empty ? <Status status={status} /> : <span />}
        <Link href={cetakHref} className="relative z-10 shrink-0 text-[0.8rem] text-[var(--tinta-2)] no-underline hover:text-[var(--aksen)] hover:underline">
          Cetak
        </Link>
      </div>
    </div>
  )
}

/** Same precedence as today's Tally: clashes, then warnings/gaps, then a quiet "bersih". */
function Status({ status }: { status: ScheduleStatus }) {
  if (status.bentrok > 0)
    return (
      <span>
        <span className="mono block text-[1.3rem] leading-none font-semibold text-[var(--merah)]">{status.bentrok}</span>
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-[var(--merah)]">bentrok</span>
      </span>
    )
  const catatan = [
    status.peringatan > 0 ? `${status.peringatan} peringatan` : null,
    status.gaps ? `${status.gaps.n} ${status.gaps.label}` : null,
  ].filter((x): x is string => !!x)
  if (catatan.length)
    return (
      <span className="text-[0.78rem] font-medium text-[var(--kuning)]">
        {catatan.map((c) => (
          <span key={c} className="block">
            {c}
          </span>
        ))}
      </span>
    )
  return <span className="text-[0.8rem] font-medium text-[var(--hijau)]">✓ bersih</span>
}

export function DaftarSidang({ data, prodiList }: { data: SidangDatang[]; prodiList: Prodi[] }) {
  if (!data.length) return <p className="m-0 py-[1rem] text-[0.87rem] text-[var(--tinta-3)]">Tidak ada jadwal 7 hari ke depan.</p>
  const duaProdi = prodiList.length > 1
  return (
    <ul className="m-0 list-none p-0">
      {data.map((s) => (
        <li key={`${s.id}-${s.jenis}`} className="flex items-start gap-[0.6rem] border-b border-[var(--garis)] py-[0.6rem] last:border-b-0">
          <span className="mono shrink-0 rounded-[var(--r-item)] bg-[var(--aksen-lembut)] px-[0.5rem] py-[0.25rem] text-[0.75rem] font-medium text-[var(--aksen)]">
            {tanggalSingkat(s.tanggal)}
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-[0.88rem] font-medium">
              {jenisLabel(s.prodi, s.jenis)} · {s.nama}
              {duaProdi && (
                <span className="ml-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] px-[0.3rem] text-[0.68rem] font-semibold text-[var(--tinta-3)]">
                  {s.prodi.toUpperCase()}
                </span>
              )}
            </p>
            <p className="m-0 text-[0.78rem] text-[var(--tinta-3)]">
              {s.jam} · {s.tempat}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** '2 jam lalu' and friends; an unparsable timestamp stays quiet. */
const waktuRelatif = (iso: string): string => {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const menit = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  return `${Math.floor(jam / 24)} hari lalu`
}

export function DaftarAktivitas({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="m-0 py-[1rem] text-[0.87rem] text-[var(--tinta-3)]">Belum ada aktivitas.</p>
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((r) => (
        <li key={r.id} className="border-b border-[var(--garis)] py-[0.5rem] last:border-b-0">
          <p className="m-0 truncate text-[0.85rem] font-medium">
            {ACTION_LABEL[r.action]} {tableLabel(r.table_name)}
          </p>
          <p className="m-0 truncate text-[0.78rem] text-[var(--tinta-3)]">{summarize(r)}</p>
          <p className="m-0 truncate text-[0.73rem] text-[var(--tinta-3)]">
            {r.actor_email ?? 'Sistem'} · {waktuRelatif(r.at)}
          </p>
        </li>
      ))}
    </ul>
  )
}
