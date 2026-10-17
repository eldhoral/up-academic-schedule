'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { DetailModal, TimeGrid, courseColor, type GridColumn } from '@/components/TimeGrid'
import { WeekNav } from '@/components/WeekNav'
import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { romanSemester } from '@/lib/print'
import { dayLabel, defaultWeek, mondayOf, weekDays } from '@/lib/week'
import { PROGRAM_LABEL, SIDANG_PERAN_LABEL } from '@/app/jadwal-dosen/events'
import { jenisLabel } from '@/app/[prodi]/sidang/defense-types'
import { type Prodi } from '@/lib/prodi'
import { GABUNGAN, KETERANGAN_LABEL, needsRoom } from '@/app/[prodi]/ujian/exam-types'
import {
  allEvents,
  weekCounts,
  type KalEventKuliah,
  type KalEventSidang,
  type KalEventUjian,
  type KalKuliah,
  type KalSidang,
  type KalTerm,
  type KalUjian,
} from './items'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

type Year = { id: string; label: string }

const PRODI_LABEL: Record<Prodi, string> = { s1: 'S1', s2: 'S2' }
const UJIAN_LABEL: Record<'uts' | 'uas', string> = { uts: 'UTS', uas: 'UAS' }

/** Tempat on the board: prasidang sits in a breakout room, sidang in a room. */
const sidangTempat = (d: KalSidang) => (d.jenis === 'prasidang' ? `Kelompok ${d.kelompok ?? ''} (Zoom)` : d.room_nama ? `Ruang ${d.room_nama}` : '—')

/** The action inside the detail modal: same language as the public jadwal-dosen rows. */
function MateriLink({ link }: { link: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.8rem] font-medium no-underline cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors"
    >
      Lihat Materi <span aria-hidden="true">&nearr;</span>
    </a>
  )
}

export function KalenderClient({
  years,
  ay,
  term,
  kuliahRows,
  ujian,
  sidang,
  initialWeek,
  loadError,
}: {
  years: Year[]
  ay: string
  term: KalTerm
  kuliahRows: KalKuliah[]
  ujian: KalUjian[]
  sidang: KalSidang[]
  initialWeek: string | null
  loadError: string | null
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const events = useMemo(
    () => allEvents(kuliahRows, ujian, sidang, term, ujian.map((e) => ({ prodi: e.prodi, jenis_kelas: e.jenis_kelas, tanggal: e.tanggal }))),
    [kuliahRows, ujian, sidang, term],
  )
  const { weeks, counts } = useMemo(() => weekCounts(events), [events])
  const [week, setWeek] = useState(initialWeek ? mondayOf(initialWeek) : defaultWeek(events.map((e) => e.tanggal), today))

  function pickYear(next: string) {
    router.push(`/kalender?ay=${encodeURIComponent(next)}`)
  }
  function pickWeek(monday: string) {
    setWeek(monday)
    window.history.replaceState(null, '', `/kalender?${new URLSearchParams({ ay, minggu: monday })}`)
  }

  const inWeek = useMemo(() => events.filter((e) => mondayOf(e.tanggal) === week), [events, week])
  const withSunday = inWeek.some((e) => hariFromTanggal(e.tanggal) === 'MINGGU')
  const days = weekDays(week, withSunday)

  const kuliahOf = (d: string) => inWeek.filter((e): e is KalEventKuliah => e.jenis === 'kuliah' && e.tanggal === d)
  const ujianOf = (d: string) => inWeek.filter((e): e is KalEventUjian => e.jenis === 'ujian' && e.tanggal === d)
  const sidangOf = (d: string) => inWeek.filter((e): e is KalEventSidang => e.jenis === 'sidang' && e.tanggal === d)

  type Sel = { kind: 'kuliah' | 'ujian' | 'sidang'; kuliah?: KalEventKuliah; ujianRows?: KalEventUjian[]; sidang?: KalEventSidang }
  const [selected, setSelected] = useState<Sel | null>(null)

  // A ujian block is one mata kuliah's kelas rows that sit together — exactly the block the per-prodi kalender draws.
  const ujianBlocksOf = (d: string) => {
    const m = new Map<string, KalEventUjian[]>()
    for (const e of ujianOf(d).sort((a, b) => a.row.kelas.localeCompare(b.row.kelas))) {
      const key = `${e.jam_mulai}|${e.jam_selesai}|${e.row.prodi}|${e.row.kode_mk}`
      const rows = m.get(key) ?? []
      rows.push(e)
      m.set(key, rows)
    }
    return [...m.values()]
  }

  // Who teaches the exam's mata kuliah: the kuliah side on the same key; GABUNGAN means every kelas of the mk.
  const pengampuOf = (prodi: Prodi, kode_mk: string, kelas: string) => {
    const taught = kuliahRows.filter((k) => k.prodi === prodi && k.kode_mk === kode_mk && (kelas === GABUNGAN || k.kelas === kelas))
    if (taught.length === 0) return null
    return [...new Set(taught.flatMap((k) => k.dosen))].join(', ') || 'MKWU'
  }

  const columns: GridColumn[] = days.map((d) => ({
    key: d,
    label: dayLabel(d),
    sub: `${kuliahOf(d).length + ujianOf(d).length + sidangOf(d).length} jadwal`,
    today: d === today,
    events: [
      ...kuliahOf(d).map((e) => ({
        id: e.id,
        jam_mulai: e.jam_mulai,
        jam_selesai: e.jam_selesai,
        title: `Kuliah ${e.row.nama_mk} — Kelas ${e.row.kelas} — ${e.jam_mulai.slice(0, 5)}–${e.jam_selesai.slice(0, 5)} — ${e.row.tempat}${e.row.minggu === 'setiap' ? '' : ` — minggu ${e.row.minggu}`}`,
        badge: `${e.row.semester_ke}${e.row.kelas}`,
        name: e.row.nama_mk,
        sub: e.row.tempat || undefined,
        colorKey: `K|${e.row.prodi}|${e.row.kode_mk}`,
        danger: e.row.is_override,
        onClick: () => setSelected({ kind: 'kuliah', kuliah: e }),
      })),
      ...ujianBlocksOf(d).map((rows) => {
        const h = rows[0]
        const kelas = rows.map((r) => r.row.kelas).join(', ')
        const rooms = [...new Set(rows.map((r) => (needsRoom(r.row.keterangan) ? r.row.room_nama : null)).filter(Boolean))].join(', ')
        return {
          id: `u-${h.id}`,
          jam_mulai: h.jam_mulai,
          jam_selesai: h.jam_selesai,
          title: `${UJIAN_LABEL[h.row.jenis_ujian]} ${h.row.nama_mk} — Kelas ${kelas} — ${h.jam_mulai.slice(0, 5)}–${h.jam_selesai.slice(0, 5)} — ${rooms || h.row.keterangan}`,
          badge: `${UJIAN_LABEL[h.row.jenis_ujian]} · ${romanSemester(h.row.semester_ke)}${kelas === GABUNGAN ? '' : ` · ${kelas}`}`,
          name: h.row.nama_mk,
          sub: rooms || KETERANGAN_LABEL[h.row.keterangan] || undefined,
          colorKey: `U|${h.row.prodi}|${h.row.kode_mk}`,
          danger: rows.some((r) => r.row.is_override),
          onClick: () => setSelected({ kind: 'ujian', ujianRows: rows }),
        }
      }),
      ...sidangOf(d).map((e) => ({
        id: e.id,
        jam_mulai: e.jam_mulai,
        jam_selesai: e.jam_selesai,
        title: `${jenisLabel(e.row.prodi, e.row.jenis)} — ${e.row.nama_mahasiswa} — ${e.jam_mulai.slice(0, 5)}–${e.jam_selesai.slice(0, 5)} — ${sidangTempat(e.row)}`,
        badge: jenisLabel(e.row.prodi, e.row.jenis),
        name: e.row.nama_mahasiswa,
        sub: sidangTempat(e.row),
        colorKey: `S|${e.row.jenis}|${e.row.prodi}`,
        danger: e.row.is_override,
        onClick: () => setSelected({ kind: 'sidang', sidang: e }),
      })),
    ],
  }))

  const termMissing = kuliahRows.length > 0 && !term?.mulai

  return (
    <div className="flex-1 flex flex-col">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="kal-ay">
          Tahun akademik
        </label>
        {years.length > 0 && <Select id="kal-ay" value={ay} onValueChange={pickYear} options={years.map((y) => ({ value: y.id, label: y.label }))} className={CONTROL} />}
        {term && (term.mulai || term.selesai) && (
          <span className="text-[0.8rem] text-[var(--tinta-3)] mono">
            {term.mulai ?? '—'} – {term.selesai ?? '—'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-[0.8rem] flex-wrap">
          <span className="text-[0.87rem] text-[var(--tinta-3)]">hanya lihat</span>
          {weeks.length > 0 && <WeekNav weeks={weeks} current={week} counts={counts} onChange={pickWeek} />}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-[1.3rem]">
        {loadError ? (
          <p className="m-0 text-[0.93rem] text-[var(--merah-teks)]">{loadError}</p>
        ) : events.length === 0 ? (
          <p className="m-0 text-[0.93rem] text-[var(--tinta-3)]">
            {kuliahRows.length === 0 && ujian.length === 0 && sidang.length === 0
              ? 'Tahun akademik ini belum punya jadwal sama sekali.'
              : 'Belum ada jadwal yang bisa ditampilkan di kalender.'}
          </p>
        ) : (
          <>
            {termMissing && (
              <p className="m-0 mb-[1rem] text-[0.87rem] text-[var(--kuning)]">
                Kuliah tidak ikut tampil: tanggal mulai dan selesai perkuliahan tahun ini belum diatur di Tahun Akademik.
              </p>
            )}
            {inWeek.length === 0 && <p className="m-0 mb-[1rem] text-[0.87rem] text-[var(--tinta-3)]">Minggu ini tidak ada jadwal — pilih minggu di atas.</p>}
            <TimeGrid columns={columns} startHour={8} endHour={17} />
          </>
        )}
      </div>

      {selected?.kind === 'kuliah' && selected.kuliah && <KuliahModal e={selected.kuliah} onClose={() => setSelected(null)} />}
      {selected?.kind === 'ujian' && selected.ujianRows && <UjianModal rows={selected.ujianRows} pengampuOf={pengampuOf} onClose={() => setSelected(null)} />}
      {selected?.kind === 'sidang' && selected.sidang && <SidangModal e={selected.sidang} onClose={() => setSelected(null)} />}
    </div>
  )
}

function KuliahModal({ e, onClose }: { e: KalEventKuliah; onClose: () => void }) {
  const k = e.row
  return (
    <DetailModal
      accent={k.is_override ? 'var(--merah)' : courseColor(`K|${k.prodi}|${k.kode_mk}`).border}
      title={k.nama_mk}
      meta={`Kuliah · ${ProdiLabel(k.prodi)} ${PROGRAM_LABEL[k.jenis_kelas]} · ${k.kode_mk}`}
      warning={k.is_override ? { title: 'Jadwal ini menerobos aturan bentrok.', detail: k.override_reason || undefined } : undefined}
      rows={[
        ['Hari & jam', `${ProdiLabel(k.prodi)} · Semester ${k.semester_ke} · ${hariLabel(hariFromTanggal(e.tanggal))} ${e.jam_mulai.slice(0, 5)}–${e.jam_selesai.slice(0, 5)}`],
        ['Kelas', k.kelas],
        ['Ruangan', k.tempat || '—'],
        ['Dosen pengampu', k.dosen.join(', ') || 'MKWU'],
        ...(k.minggu === 'setiap' ? [] : ([['Minggu', `minggu ${k.minggu}`]] as [string, string][])),
      ]}
      onClose={onClose}
    />
  )
}

function UjianModal({
  rows,
  pengampuOf,
  onClose,
}: {
  rows: KalEventUjian[]
  pengampuOf: (prodi: Prodi, kode_mk: string, kelas: string) => string | null
  onClose: () => void
}) {
  const h = rows[0]
  const dosenArg = rows.length === 1 ? rows[0].row.kelas : GABUNGAN
  return (
    <DetailModal
      accent={rows.some((r) => r.row.is_override) ? 'var(--merah)' : courseColor(`U|${h.row.prodi}|${h.row.kode_mk}`).border}
      title={h.row.nama_mk}
      meta={`${UJIAN_LABEL[h.row.jenis_ujian]} · ${ProdiLabel(h.row.prodi)} · Semester ${h.row.semester_ke} · ${h.row.kode_mk}`}
      warning={rows.some((r) => r.row.is_override) ? { title: 'Ujian ini menerobos aturan bentrok.' } : undefined}
      rows={[
        ['Hari & jam', `${hariLabel(hariFromTanggal(h.tanggal))} ${h.jam_mulai.slice(0, 5)}–${h.jam_selesai.slice(0, 5)}`],
        ['Dosen pengampu', pengampuOf(h.row.prodi, h.row.kode_mk, dosenArg) ?? '—'],
        ...rows.map((r): [string, React.ReactNode] => [
          r.row.kelas === GABUNGAN ? 'Kelas GABUNGAN' : `Kelas ${r.row.kelas}`,
          <>
            {r.row.pengawas.join(', ') || '—'}
            {needsRoom(r.row.keterangan) && <span className="text-[var(--tinta-3)]"> · {r.row.room_nama ?? 'tanpa ruangan'}</span>}
          </>,
        ]),
      ]}
      onClose={onClose}
    />
  )
}

function SidangModal({ e, onClose }: { e: KalEventSidang; onClose: () => void }) {
  const d = e.row
  const roleRows: [string, string][] = []
  if (d.pembimbing) roleRows.push([SIDANG_PERAN_LABEL[d.jenis].pembimbing, d.pembimbing])
  if (d.penguji) roleRows.push([SIDANG_PERAN_LABEL[d.jenis].penguji, d.penguji])
  if (d.eksternal) roleRows.push([SIDANG_PERAN_LABEL[d.jenis].eksternal, d.eksternal])
  return (
    <DetailModal
      accent={d.is_override ? 'var(--merah)' : courseColor(`S|${d.jenis}|${d.prodi}`).border}
      title={`${jenisLabel(d.prodi, d.jenis)} — ${d.nama_mahasiswa}`}
      meta={`${d.npm} · ${ProdiLabel(d.prodi)}`}
      warning={d.is_override ? { title: 'Sidang ini menerobos aturan bentrok.', detail: d.override_reason || undefined } : undefined}
      rows={[
        ['Hari & jam', `${hariLabel(hariFromTanggal(e.tanggal))} ${e.jam_mulai.slice(0, 5)}–${e.jam_selesai.slice(0, 5)}`],
        ['Judul', d.judul_skripsi || '—'],
        ['Tempat', sidangTempat(d)],
        ...roleRows,
        ['Materi', d.link ? <MateriLink key="materi" link={d.link} /> : '—'],
      ]}
      onClose={onClose}
    />
  )
}

function ProdiLabel(p: Prodi) {
  return PRODI_LABEL[p]
}