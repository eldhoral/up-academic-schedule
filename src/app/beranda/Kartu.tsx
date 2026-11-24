import Link from 'next/link'
import { ACTION_LABEL, summarize, tableLabel, type AuditRow } from '@/lib/audit-log'
import { namaLogin } from '@/lib/login'
import type { Prodi } from '@/lib/prodi'
import type { SidangDatang } from '../beranda-data'
import type { ScheduleStatus } from '../hub-status'
import { jenisLabel, tanggalSingkat } from '../[prodi]/sidang/defense-types'

/**
 * A module tile (Final-Beranda): title, big figure + unit, arrow button; the header is the card's link.
 * The footer (status + Cetak) sits at the bottom with margin-top: auto, so dividers line up across a row.
 * Empty tiles (Final-Beranda-Kosong) put their text in the figure's slot and turn the arrow grey.
 */
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
  const isi = adaTahun && status && !status.empty ? status : null
  const kosong = !adaTahun ? 'Belum ada tahun akademik' : !status ? 'Status belum bisa dibaca' : 'Belum ada jadwal'
  const panah = !isi
    ? 'bg-[var(--kertas)] text-[var(--tinta-2)]'
    : isi.bentrok > 0
      ? 'bg-[var(--merah-lembut)] text-[var(--merah)]'
      : 'bg-[var(--aksen-lembut)] text-[var(--aksen)]'
  return (
    <div className="flex flex-col gap-[0.63rem] rounded-[var(--r-kartu)] border border-[var(--garis-kuat)] bg-[var(--lembar)] p-[1rem]">
      <Link href={href} className="group flex items-start justify-between gap-[0.75rem] text-[var(--tinta)] no-underline">
        <span className="min-w-0">
          <span className="block text-[0.88rem] text-[var(--tinta-3)]">{judul}</span>
          {/* Same height filled or empty, so an empty tile's text ends on its neighbour's figure line. */}
          <span className="mt-[0.38rem] flex h-[2.2rem] items-end">
            {isi ? (
              <span className="flex items-baseline gap-[0.3rem]">
                <span className="text-[1.75rem] leading-none font-semibold">{isi.figure}</span>
                <span className="text-[0.88rem] text-[var(--tinta-2)]">{isi.label}</span>
              </span>
            ) : (
              <span className="text-[0.88rem] text-[var(--tinta-3)]">{kosong}</span>
            )}
          </span>
        </span>
        <span aria-hidden="true" className={`flex size-[2.75rem] shrink-0 items-center justify-center rounded-[var(--r-item)] transition-transform group-hover:translate-x-[2px] ${panah}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
      <div className={`mt-auto flex items-center gap-[0.5rem] border-t border-[var(--garis)] pt-[0.63rem] text-[0.82rem] ${isi ? 'justify-between' : 'justify-end'}`}>
        {isi && <Status status={isi} />}
        <Link href={cetakHref} className="shrink-0 text-[var(--tinta-2)] hover:text-[var(--aksen)] hover:underline">
          Cetak
        </Link>
      </div>
    </div>
  )
}

/** Same precedence as the old Tally: clashes, then warnings/gaps, then a quiet "bersih". */
function Status({ status }: { status: ScheduleStatus }) {
  if (status.bentrok > 0) return <span className="font-semibold text-[var(--merah)]">{status.bentrok} bentrok</span>
  const catatan = [
    status.peringatan > 0 ? `${status.peringatan} peringatan` : null,
    status.gaps ? `${status.gaps.n} ${status.gaps.label}` : null,
  ].filter((x): x is string => !!x)
  if (catatan.length) return <span className="font-medium text-[var(--kuning)]">{catatan.join(' · ')}</span>
  return <span className="font-medium text-[var(--hijau)]">✓ bersih</span>
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
            {r.actor_email ? namaLogin(r.actor_email) : 'Sistem'} · {waktuRelatif(r.at)}
          </p>
        </li>
      ))}
    </ul>
  )
}
