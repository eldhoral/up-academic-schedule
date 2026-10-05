'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { FindingsBar } from '@/components/FindingsBar'
import { BandRow, PreviewTable, cell } from '@/components/preview'
import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { addExamRowAction, seedExamsFromKuliahAction, type ExamFinding, type ExamSide } from './actions'
import { ExamBlockModal } from './ExamBlockModal'
import {
  GABUNGAN,
  KETERANGAN_LABEL,
  needsRoom,
  shortDate,
  type ExamContext,
  type ExamView,
  type PengawasItem,
} from './exam-types'
import type { AddableExam } from './exam-query'
import type { AcademicYear } from '../kuliah/penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'
const UJIAN_LABEL = { uts: 'UTS', uas: 'UAS' }
const PROGRAM_LABEL = { reguler: 'Reguler', regsus: 'Reguler Khusus' }

type Option = { value: string; label: string }
type Block = { kode_mk: string; nama_mk: string; sks: number | null; rows: ExamView[] }

export function UjianClient({
  academicYears,
  context,
  exams,
  addable,
  kelasByMk,
  findings,
  lecturers,
  rooms,
  sesi,
  fixedNames,
  canEdit,
}: {
  academicYears: AcademicYear[]
  context: ExamContext
  exams: ExamView[]
  addable: AddableExam[]
  kelasByMk: Record<string, string[]>
  findings: ExamFinding[]
  lecturers: Option[]
  rooms: Option[]
  sesi: { mulai: string; selesai: string }[]
  fixedNames: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Block | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const lecturerNames = useMemo(() => Object.fromEntries(lecturers.map((l) => [l.value, l.label])), [lecturers])

  function go(next: Partial<ExamContext>) {
    const m = { ...context, ...next }
    router.push(`/ujian?${new URLSearchParams({ ay: m.academic_year_id, ujian: m.jenis_ujian, jenis: m.jenis_kelas, smt: String(m.semester_ke) })}`)
  }

  const pengawasName = (p: PengawasItem) => ('kode_dosen' in p ? (lecturerNames[p.kode_dosen] ?? p.kode_dosen) : p.nama)

  const blocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byMk = new Map<string, Block>()
    for (const e of exams) {
      const b = byMk.get(e.kode_mk) ?? { kode_mk: e.kode_mk, nama_mk: e.courses?.nama_mk ?? e.kode_mk, sks: e.courses?.sks ?? null, rows: [] }
      b.rows.push(e)
      byMk.set(e.kode_mk, b)
    }
    return [...byMk.values()]
      .map((b) => ({ ...b, rows: [...b.rows].sort((x, y) => x.kelas.localeCompare(y.kelas)) }))
      .filter(
        (b) =>
          !q ||
          `${b.kode_mk} ${b.nama_mk}`.toLowerCase().includes(q) ||
          b.rows.some((r) => `${r.kelas} ${r.dosen.join(' ')} ${r.pengawas.map(pengawasName).join(' ')}`.toLowerCase().includes(q)),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exams, query, lecturerNames])

  const unscheduled = blocks.filter((b) => !b.rows[0].tanggal).sort((a, b) => a.kode_mk.localeCompare(b.kode_mk))
  const scheduled = blocks
    .filter((b) => b.rows[0].tanggal)
    .sort((a, b) => (a.rows[0].tanggal! + a.rows[0].jam_mulai).localeCompare(b.rows[0].tanggal! + b.rows[0].jam_mulai) || a.kode_mk.localeCompare(b.kode_mk))

  const notes = [
    [exams.filter((e) => !e.tanggal).length, 'ujian belum diberi tanggal'],
    [exams.filter((e) => needsRoom(e.keterangan_ujian) && !e.room_id).length, 'ujian luring tanpa ruangan'],
    [exams.filter((e) => needsRoom(e.keterangan_ujian) && e.pengawas.length === 0).length, 'ujian luring tanpa pengawas'],
    [exams.filter((e) => !e.inKuliah).length, 'ujian tidak ada lagi di jadwal kuliah'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, text]) => `${n} ${text}`)

  const yearLabel = academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? 'tahun ini'
  const columns = [
    { label: 'Tanggal', align: 'center' as const },
    { label: 'Jam', align: 'center' as const },
    { label: 'Kode MK', align: 'center' as const },
    { label: 'Mata Kuliah' },
    { label: 'SKS', align: 'center' as const },
    { label: 'Kelas', align: 'center' as const },
    { label: 'Dosen Pengampu' },
    { label: 'Pengawas' },
    { label: 'Ruangan', align: 'center' as const },
    { label: 'Keterangan', align: 'center' as const },
    ...(canEdit ? [{ label: 'Aksi', align: 'center' as const }] : []),
  ]

  function viewFinding(side: ExamSide) {
    router.push(
      `/ujian?${new URLSearchParams({ ay: context.academic_year_id, ujian: side.jenis_ujian, jenis: side.jenis_kelas, smt: String(side.semester_ke) })}`,
    )
  }

  function seed() {
    setMessage(null)
    startTransition(async () => {
      const res = await seedExamsFromKuliahAction({ academic_year_id: context.academic_year_id, jenis_ujian: context.jenis_ujian, jenis_kelas: context.jenis_kelas })
      if ('error' in res) setMessage({ ok: false, text: res.error })
      else {
        setMessage({ ok: true, text: ('message' in res && res.message) || 'Selesai.' })
        router.refresh()
      }
    })
  }

  function add(value: string) {
    const [kode_mk, kelas] = value.split('|')
    setMessage(null)
    startTransition(async () => {
      const res = await addExamRowAction(context, kode_mk, kelas)
      if ('error' in res) setMessage({ ok: false, text: res.error })
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => go({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ujian">
          Ujian
        </label>
        <Select
          id="ctx-ujian"
          value={context.jenis_ujian}
          onValueChange={(v) => go({ jenis_ujian: v as 'uts' | 'uas' })}
          options={[
            { value: 'uts', label: 'UTS' },
            { value: 'uas', label: 'UAS' },
          ]}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Program
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => go({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => go({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className={CONTROL}
        />

        <span className="ml-auto text-[0.87rem] text-[var(--tinta-3)]">
          {exams.length} baris &middot; {exams.filter((e) => e.tanggal).length} terjadwal
        </span>
      </div>

      <div className="p-[1.07rem_1.3rem_1.3rem]">
        <FindingsBar
          scopeLabel={yearLabel}
          notes={notes}
          onView={viewFinding}
          findings={findings.map((f) => ({
            policy: f.policy === 'blok' ? 'blok' : 'peringatan',
            where: `${hariLabel(hariFromTanggal(f.a.tanggal))} ${shortDate(f.a.tanggal)} · ${f.a.jam_mulai}`,
            text: (
              <>
                <b className="font-semibold">{f.a.nama_mk}</b> ({UJIAN_LABEL[f.a.jenis_ujian as 'uts' | 'uas']}) dan <b className="font-semibold">{f.b.nama_mk}</b> (
                {UJIAN_LABEL[f.b.jenis_ujian as 'uts' | 'uas']}) berjalan pada waktu yang sama &mdash;{' '}
                {f.type === 'pengawas' ? `${f.detail} mengawasi keduanya` : f.type === 'ruangan' ? `ruangan ${f.detail} terpakai ganda` : `${f.detail} duduk di keduanya`}.
              </>
            ),
            minutes: f.overlapMinutes,
            target: f.a,
          }))}
        />

        <div className="flex items-end justify-between gap-[1rem] mb-[1rem] flex-wrap">
          <div>
            <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.015em]">
              {UJIAN_LABEL[context.jenis_ujian]} &middot; Semester {context.semester_ke} &middot; {PROGRAM_LABEL[context.jenis_kelas]}
            </h1>
            <p className="mt-[0.27rem] text-[0.93rem] text-[var(--tinta-3)]">
              Satu blok per mata kuliah; ubah blok untuk mengatur tanggal, jam, pengawas, dan ruangan semua kelasnya.
            </p>
          </div>
          <div className="flex items-center gap-[0.53rem] flex-wrap">
            <input
              type="search"
              placeholder="Cari kode, mata kuliah, dosen, pengawas…"
              aria-label="Cari ujian"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${CONTROL} min-w-[16rem]`}
            />
            {canEdit && addable.length > 0 && exams.length > 0 && (
              <Select
                value=""
                onValueChange={add}
                placeholder="+ Tambah mata kuliah"
                ariaLabel="Tambah mata kuliah"
                options={addable.map((a) => ({ value: `${a.kode_mk}|${a.kelas}`, label: `${a.kode_mk} — ${a.nama_mk} — Kelas ${a.kelas}` }))}
                className={CONTROL}
              />
            )}
            {canEdit && (
              <button
                type="button"
                onClick={seed}
                disabled={isPending}
                className="px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] font-medium cursor-pointer hover:bg-[var(--lembar)] active:scale-[0.97] transition-colors text-[0.93rem] disabled:opacity-60 disabled:cursor-wait"
              >
                {isPending ? 'Menyalin…' : 'Isi dari jadwal kuliah'}
              </button>
            )}
          </div>
        </div>

        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`m-0 mb-[1rem] text-[0.87rem] ${message.ok ? 'text-[var(--tinta-2)]' : 'text-[var(--merah-teks)]'}`}>
            {message.text}
          </p>
        )}

        {exams.length === 0 ? (
          <div className="flex justify-center py-[2rem]">
            <div className="w-full max-w-[26rem] flex flex-col items-center gap-[0.4rem] text-center bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.6rem]">
              <h2 className="m-0 text-[1.07rem] font-semibold text-balance">
                Belum ada jadwal {UJIAN_LABEL[context.jenis_ujian]} untuk Semester {context.semester_ke} &middot; {PROGRAM_LABEL[context.jenis_kelas]}
              </h2>
              <p className="m-0 text-[0.87rem] text-[var(--tinta-3)] text-pretty">
                {addable.length > 0
                  ? 'Jadwal kuliah semester ini sudah ada. Salin kelasnya, lalu atur tanggal dan pengawas.'
                  : `Belum ada jadwal kuliah untuk Semester ${context.semester_ke} · ${PROGRAM_LABEL[context.jenis_kelas]}, jadi belum ada kelas yang bisa diujikan.`}
              </p>
              {addable.length > 0 && canEdit ? (
                <button
                  type="button"
                  onClick={seed}
                  disabled={isPending}
                  className="mt-[0.8rem] px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem] disabled:opacity-60"
                >
                  Isi dari jadwal kuliah
                </button>
              ) : addable.length === 0 ? (
                <Link
                  href={`/kuliah?${new URLSearchParams({ ay: context.academic_year_id, jenis: context.jenis_kelas, smt: String(context.semester_ke) })}`}
                  className="mt-[0.8rem] inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[var(--tinta)] text-[0.93rem] font-medium no-underline hover:bg-[var(--lembar)]"
                >
                  Buka Penjadwalan
                </Link>
              ) : null}
            </div>
          </div>
        ) : blocks.length === 0 ? (
          <p className="text-[0.93rem] text-[var(--tinta-3)] py-[2rem] text-center">Tidak ada ujian yang cocok dengan pencarian.</p>
        ) : (
          <PreviewTable label={`Jadwal ${UJIAN_LABEL[context.jenis_ujian]} semester ${context.semester_ke}`} columns={columns}>
            {unscheduled.length > 0 && <BandRow span={columns.length}>Belum dijadwalkan ({unscheduled.length})</BandRow>}
            {unscheduled.map((b) => (
              <BlockRows key={b.kode_mk} block={b} edgeClass="border-[var(--garis)]" pengawasName={pengawasName} canEdit={canEdit} onEdit={() => setEditing(b)} />
            ))}
            {scheduled.map((b, i) => (
              <BlockRows
                key={b.kode_mk}
                block={b}
                // A new date gets the stronger rule, so the days read down the page.
                edgeClass={i === 0 || scheduled[i - 1].rows[0].tanggal !== b.rows[0].tanggal ? 'border-[var(--garis-kuat)]' : 'border-[var(--garis)]'}
                pengawasName={pengawasName}
                canEdit={canEdit}
                onEdit={() => setEditing(b)}
              />
            ))}
          </PreviewTable>
        )}
      </div>

      {editing && (
        <ExamBlockModal
          key={editing.kode_mk}
          context={context}
          kode_mk={editing.kode_mk}
          nama_mk={editing.nama_mk}
          sks={editing.sks}
          rows={editing.rows}
          kelasChoices={[...new Set([...(kelasByMk[editing.kode_mk] ?? []), ...editing.rows.map((r) => r.kelas).filter((k) => k !== GABUNGAN)])].sort()}
          lecturers={lecturers}
          rooms={rooms}
          sesi={sesi}
          fixedNames={fixedNames}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function BlockRows({
  block,
  edgeClass,
  pengawasName,
  canEdit,
  onEdit,
}: {
  block: Block
  edgeClass: string
  pengawasName: (p: PengawasItem) => string
  canEdit: boolean
  onEdit: () => void
}) {
  const span = block.rows.length
  const head = block.rows[0]
  const muted = 'text-[var(--tinta-3)]'

  return (
    <>
      {block.rows.map((r, i) => (
        <tr key={r.id} className={`h-[2.6rem] border-t align-top ${i === 0 ? edgeClass : 'border-[var(--garis)]'} ${r.is_override ? 'bg-[var(--merah-lembut)]' : ''}`}>
          {i === 0 && (
            <>
              <td rowSpan={span} className={`${cell('center')} whitespace-nowrap`}>
                {head.tanggal ? (
                  <>
                    <div className="font-medium">{hariLabel(hariFromTanggal(head.tanggal))}</div>
                    <div className="mono text-[0.8rem] text-[var(--tinta-3)]">{shortDate(head.tanggal)}</div>
                  </>
                ) : (
                  <span className={muted}>—</span>
                )}
              </td>
              <td rowSpan={span} className={`${cell('center')} mono whitespace-nowrap`}>
                {head.jam_mulai ? `${head.jam_mulai.slice(0, 5)}–${head.jam_selesai!.slice(0, 5)}` : <span className={muted}>—</span>}
              </td>
              <td rowSpan={span} className={`${cell('center')} mono`}>
                {block.kode_mk}
              </td>
              <td rowSpan={span} className={`${cell()} font-medium`}>
                {block.nama_mk}
              </td>
              <td rowSpan={span} className={`${cell('center')} mono`}>
                {block.sks ?? '—'}
              </td>
            </>
          )}
          <td className={`${cell('center')} mono`}>
            {r.kelas}
            {!r.inKuliah && (
              <span title="Tidak ada lagi di jadwal kuliah" className="ml-[0.27rem] text-[var(--kuning)]">
                !
              </span>
            )}
          </td>
          <td className={cell()}>{r.dosen.length === 0 ? <span className="text-[0.8rem] px-[0.47rem] py-[0.07rem] rounded-full border border-[var(--garis-kuat)] text-[var(--tinta-2)] bg-[var(--cekung)]">MKWU</span> : r.dosen.join(', ')}</td>
          <td className={cell()}>
            {r.pengawas.length === 0 ? (
              <span className={muted}>—</span>
            ) : (
              r.pengawas.map((p, j) =>
                'kode_dosen' in p ? (
                  <div key={j}>{pengawasName(p)}</div>
                ) : (
                  // Free text has no identity behind it, so it is drawn as a dashed chip, not a name.
                  <div key={j}>
                    <span className="inline-block text-[0.87rem] px-[0.47rem] py-[0.07rem] rounded-full border border-dashed border-[var(--garis-kuat)] text-[var(--tinta-2)]">{p.nama}</span>
                  </div>
                ),
              )
            )}
          </td>
          <td className={`${cell('center')} mono`}>{needsRoom(r.keterangan_ujian) ? (r.rooms?.nama ?? <span className={muted}>—</span>) : <span className={muted}>—</span>}</td>
          <td className={`${cell('center')} whitespace-nowrap`}>{KETERANGAN_LABEL[r.keterangan_ujian]}</td>
          {i === 0 && canEdit && (
            <td rowSpan={span} className={cell('center')}>
              <button type="button" onClick={onEdit} className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]">
                Ubah
              </button>
            </td>
          )}
        </tr>
      ))}
    </>
  )
}
