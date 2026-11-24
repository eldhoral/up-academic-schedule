import Link from 'next/link'
import { ACTION_LABEL, summarize, tableLabel, type AuditRow } from '@/lib/audit-log'
import { namaLogin } from '@/lib/login'
import type { Prodi } from '@/lib/prodi'
import type { SidangDatang } from '../beranda-data'
import type { ScheduleStatus } from '../hub-status'
import { jenisLabel } from '../[prodi]/sidang/defense-types'

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
    <div className="flex flex-col gap-[0.667rem] rounded-[var(--r-kartu)] border border-[var(--garis)] bg-[var(--lembar)] p-[1.067rem]">
      <Link href={href} className="group flex items-start justify-between gap-[0.8rem] text-[var(--tinta)] no-underline">
        <span className="min-w-0">
          <span className="block text-[0.933rem] text-[var(--tinta-3)]">{judul}</span>
          {/* Same height filled or empty, so an empty tile's text ends on its neighbour's figure line. */}
          <span className="mt-[0.4rem] flex h-[2.4rem] items-end">
            {isi ? (
              <span className="flex items-baseline gap-[0.3rem]">
                <span className="text-[1.867rem] leading-none font-semibold">{isi.figure}</span>
                <span className="text-[0.933rem] text-[var(--tinta-2)]">{isi.label}</span>
              </span>
            ) : (
              <span className="text-[0.933rem] text-[var(--tinta-3)]">{kosong}</span>
            )}
          </span>
        </span>
        <span aria-hidden="true" className={`flex size-[2.933rem] shrink-0 items-center justify-center rounded-[var(--r-item)] transition-transform group-hover:translate-x-[2px] ${panah}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
      <div className={`mt-auto flex items-center gap-[0.5rem] border-t border-[var(--garis)] pt-[0.667rem] text-[0.867rem] ${isi ? 'justify-between' : 'justify-end'}`}>
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

const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const TAG: Record<Prodi, string> = {
  s1: 'text-[var(--hijau)] bg-[var(--hijau-lembut)]',
  s2: 'text-[var(--aksen)] bg-[var(--aksen-lembut)]',
}

export function DaftarSidang({ data, prodiList }: { data: SidangDatang[]; prodiList: Prodi[] }) {
  if (!data.length) return <p className="m-0 py-[1rem] text-[0.933rem] text-[var(--tinta-3)]">Tidak ada jadwal 7 hari ke depan.</p>
  const duaProdi = prodiList.length > 1
  return (
    <>
      {data.map((s) => {
        const tgl = new Date(`${s.tanggal}T00:00:00Z`)
        return (
          <div key={`${s.id}-${s.jenis}`} className="flex items-start gap-[0.8rem]">
            <div className="w-[2.933rem] shrink-0 rounded-[var(--r-item)] bg-[var(--cekung)] py-[0.333rem] text-center">
              <div className="text-[0.733rem] text-[var(--tinta-3)]">{HARI_PENDEK[tgl.getUTCDay()]}</div>
              <div className="text-[1.133rem] font-semibold">{tgl.getUTCDate()}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[0.933rem] font-semibold">
                {jenisLabel(s.prodi, s.jenis)} · {s.nama}
                {duaProdi && <span className={`ml-[0.267rem] rounded-[4px] px-[0.333rem] py-px text-[0.733rem] font-medium ${TAG[s.prodi]}`}>{s.prodi.toUpperCase()}</span>}
              </div>
              <div className="text-[0.867rem] text-[var(--tinta-3)]">
                {s.jam} · {s.tempat}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** '2 jam lalu' and friends; an unparsable timestamp stays quiet. */
const waktuRelatif = (iso: string): string => {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const menit = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} mnt lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  return `${Math.floor(jam / 24)} hari lalu`
}

/** Tambah green, Ubah blue (Final-Beranda); Hapus red; anything else grey. */
const TITIK: Partial<Record<AuditRow['action'], string>> = { INSERT: 'bg-[var(--aksen-2)]', UPDATE: 'bg-[var(--aksen)]', DELETE: 'bg-[var(--merah)]' }

export function DaftarAktivitas({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="m-0 py-[1rem] text-[0.933rem] text-[var(--tinta-3)]">Belum ada aktivitas.</p>
  return (
    <>
      {rows.map((r) => (
        <div key={r.id} className="flex gap-[0.667rem]">
          <span aria-hidden="true" className={`mt-[0.467rem] size-[0.533rem] shrink-0 rounded-full ${TITIK[r.action] ?? 'bg-[var(--tinta-3)]'}`} />
          <div className="min-w-0">
            <div className="truncate text-[0.933rem] font-semibold">
              {ACTION_LABEL[r.action]} {tableLabel(r.table_name)}
            </div>
            <div className="truncate text-[0.867rem] text-[var(--tinta-3)]">{summarize(r)}</div>
            <div className="truncate text-[0.8rem] text-[var(--tinta-3)]">
              {r.actor_email ? namaLogin(r.actor_email) : 'Sistem'} · {waktuRelatif(r.at)}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
