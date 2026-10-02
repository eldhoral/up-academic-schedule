'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FindingsBar } from '@/components/FindingsBar'
import { Select } from '@/components/Select'
import type { DefenseFinding, DefenseSide } from './actions'
import { DefenseFormModal, type DefenseDraft } from './DefenseFormModal'
import { JENIS_LABEL, slotLabel, tanggalSingkat, type DefenseContext, type DefenseRow } from './defense-types'
import type { AcademicYear } from '../kuliah/penjadwalan-types'

type Option = { value: string; label: string }

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'
const ADD_ROOM = '__add_room__'

export function SidangClient({
  academicYears,
  context,
  defenses,
  findings,
  lecturers,
  rooms,
  sesi,
  externalNames,
  initialTanggal,
  canEdit,
}: {
  academicYears: AcademicYear[]
  context: DefenseContext
  defenses: DefenseRow[]
  findings: DefenseFinding[]
  lecturers: Option[]
  rooms: Option[]
  sesi: { mulai: string; selesai: string }[]
  externalNames: string[]
  initialTanggal: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const sidang = context.jenis === 'sidang'
  const [addedDates, setAddedDates] = useState<string[]>(initialTanggal ? [initialTanggal] : [])
  const [extraCols, setExtraCols] = useState<string[]>([]) // rooms (sidang) or kelompok numbers (prasidang) opened but not used yet
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<DefenseDraft | null>(null)

  const dates = useMemo(() => [...new Set([...defenses.map((d) => d.tanggal), ...addedDates])].sort(), [defenses, addedDates])
  const [tanggal, setTanggal] = useState(initialTanggal ?? defenses[0]?.tanggal ?? '')

  const lecturerName = useMemo(() => Object.fromEntries(lecturers.map((l) => [l.value, l.label])), [lecturers])
  const roomName = useMemo(() => Object.fromEntries(rooms.map((r) => [r.value, r.label])), [rooms])
  const name = (kode: string | null) => (kode ? (lecturerName[kode] ?? kode) : '—')

  const q = query.trim().toLowerCase()
  const matchIds = useMemo(
    () => new Set(q ? defenses.filter((d) => d.npm.includes(q) || d.nama_mahasiswa.toLowerCase().includes(q)).map((d) => d.id) : []),
    [defenses, q],
  )

  // The worst finding touching each defense: a blocking clash paints it red, a warning yellow.
  const severity = useMemo(() => {
    const m = new Map<string, 'blok' | 'peringatan'>()
    for (const f of findings) {
      for (const id of [f.a.id, f.b?.id]) {
        if (!id) continue
        if (f.policy === 'blok' || !m.has(id)) m.set(id, f.policy === 'blok' ? 'blok' : 'peringatan')
      }
    }
    return m
  }, [findings])

  const dayRows = useMemo(() => defenses.filter((d) => d.tanggal === tanggal), [defenses, tanggal])

  // Board columns: the rooms (or kelompok) the day uses, plus any opened with "+".
  const colIds = sidang
    ? [...new Set([...dayRows.map((d) => d.room_id).filter((r): r is string => !!r), ...extraCols])].sort((a, b) => (roomName[a] ?? '').localeCompare(roomName[b] ?? ''))
    : Array.from({ length: Math.max(1, ...dayRows.map((d) => d.kelompok ?? 0), ...extraCols.map(Number)) }, (_, i) => String(i + 1))
  const colLabel = (id: string) => (sidang ? `Ruang ${roomName[id] ?? '?'}` : `Kelompok ${id}`)
  const colOf = (d: DefenseRow) => (sidang ? d.room_id : d.kelompok === null ? null : String(d.kelompok))

  // Board rows: the configured slots, plus any odd time actually in use.
  const slots = useMemo(() => {
    const all = new Map(sesi.map((s) => [`${s.mulai}-${s.selesai}`, s]))
    for (const d of dayRows) all.set(`${d.jam_mulai}-${d.jam_selesai}`, { mulai: d.jam_mulai, selesai: d.jam_selesai })
    return [...all.values()].sort((a, b) => a.mulai.localeCompare(b.mulai) || a.selesai.localeCompare(b.selesai))
  }, [sesi, dayRows])

  function go(next: Partial<DefenseContext>, day?: string) {
    const m = { ...context, ...next }
    router.push(`/sidang?${new URLSearchParams({ ay: m.academic_year_id, jenis: m.jenis, ...(day ? { tanggal: day } : {}) })}`)
  }

  function pickDate(d: string) {
    setTanggal(d)
    setExtraCols([])
    window.history.replaceState(null, '', `/sidang?${new URLSearchParams({ ay: context.academic_year_id, jenis: context.jenis, tanggal: d })}`)
  }

  function search(value: string) {
    setQuery(value)
    const v = value.trim().toLowerCase()
    const hit = v ? defenses.find((d) => d.npm.includes(v) || d.nama_mahasiswa.toLowerCase().includes(v)) : null
    if (hit && hit.tanggal !== tanggal) pickDate(hit.tanggal)
  }

  function open(row: DefenseRow | null, slot?: { mulai: string; selesai: string }, col?: string) {
    setDraft({
      row,
      tanggal: row?.tanggal ?? tanggal,
      jam_mulai: row?.jam_mulai ?? slot?.mulai ?? '',
      jam_selesai: row?.jam_selesai ?? slot?.selesai ?? '',
      room_id: row?.room_id ?? (sidang ? (col ?? '') : ''),
      kelompok: row?.kelompok ?? (sidang ? null : col ? Number(col) : 1),
    })
  }

  const yearLabel = academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? 'tahun ini'
  const freeRooms = rooms.filter((r) => !colIds.includes(r.value))

  function viewFinding(side: DefenseSide) {
    if (side.jenis === context.jenis) {
      pickDate(side.tanggal)
      return
    }
    go({ jenis: side.jenis }, side.tanggal)
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

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis}
          onValueChange={(v) => go({ jenis: v as 'prasidang' | 'sidang' })}
          options={[
            { value: 'prasidang', label: 'Prasidang' },
            { value: 'sidang', label: 'Sidang' },
          ]}
          className={CONTROL}
        />

        <input
          type="search"
          placeholder="Cari NPM atau nama…"
          aria-label="Cari NPM atau nama mahasiswa"
          value={query}
          onChange={(e) => search(e.target.value)}
          className={`${CONTROL} ml-[0.53rem] min-w-[14rem]`}
        />

        <span className="ml-auto text-[0.87rem] text-[var(--tinta-3)]">
          {defenses.length} mahasiswa &middot; {dates.length} hari
        </span>
      </div>

      <div className="p-[1.07rem_1.3rem_1.3rem]">
        <FindingsBar
          scopeLabel={yearLabel}
          onView={viewFinding}
          findings={findings.map((f) => ({
            policy: f.policy === 'blok' ? 'blok' : 'peringatan',
            where: `${tanggalSingkat(f.a.tanggal)} · ${f.a.jam_mulai}`,
            text: f.b ? (
              <>
                <b className="font-semibold">{f.a.nama_mahasiswa}</b> ({JENIS_LABEL[f.a.jenis]}) dan <b className="font-semibold">{f.b.nama_mahasiswa}</b> ({JENIS_LABEL[f.b.jenis]}) pada waktu yang sama &mdash;{' '}
                {f.type === 'ruangan' ? `${f.detail} terpakai ganda` : f.type === 'eksternal' ? `${f.detail} menguji keduanya` : `${f.detail} hadir di keduanya`}.
              </>
            ) : (
              <>
                <b className="font-semibold">{f.a.nama_mahasiswa}</b> ({JENIS_LABEL[f.a.jenis]}) &mdash; {f.detail} mengajar {f.teaching} pada jam yang sama.
              </>
            ),
            minutes: f.overlapMinutes,
            target: f.a,
          }))}
        />

        <div className="flex items-end justify-between gap-[1rem] mb-[0.8rem] flex-wrap">
          <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.015em]">{JENIS_LABEL[context.jenis]}</h1>
          {canEdit && (
            <button
              type="button"
              onClick={() => open(null)}
              disabled={!tanggal}
              title={tanggal ? undefined : 'Pilih atau tambah tanggal dulu'}
              className="px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Tambah {JENIS_LABEL[context.jenis].toLowerCase()}
            </button>
          )}
        </div>

        <div className="flex items-center gap-[0.4rem] flex-wrap mb-[1rem]" role="group" aria-label="Tanggal">
          {dates.map((d) => {
            const active = d === tanggal
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => pickDate(d)}
                className={`px-[0.7rem] py-[0.33rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border text-[0.93rem] cursor-pointer transition-colors ${
                  active ? 'bg-[var(--biru-lembut)] border-[var(--biru)] text-[var(--biru)] font-medium' : 'bg-[var(--lembar)] border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--cekung)]'
                }`}
              >
                {tanggalSingkat(d)} <span className="mono text-[0.8rem]">· {defenses.filter((x) => x.tanggal === d).length}</span>
              </button>
            )
          })}
          {canEdit && (
            <input
              type="date"
              aria-label="Tambah tanggal"
              value=""
              onChange={(e) => {
                if (!e.target.value) return
                setAddedDates((a) => [...a, e.target.value])
                pickDate(e.target.value)
              }}
              className={`${CONTROL} mono`}
            />
          )}
        </div>

        {!tanggal ? (
          <div className="flex justify-center py-[2rem]">
            <div className="w-full max-w-[26rem] flex flex-col items-center gap-[0.4rem] text-center bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.6rem]">
              <h2 className="m-0 text-[1.07rem] font-semibold text-balance">
                Belum ada jadwal {JENIS_LABEL[context.jenis].toLowerCase()} di {yearLabel}
              </h2>
              <p className="m-0 text-[0.87rem] text-[var(--tinta-3)] text-pretty">{canEdit ? 'Pilih tanggal dengan kolom tanggal di atas, lalu isi papan jadwalnya.' : 'Jadwalnya belum diisi.'}</p>
            </div>
          </div>
        ) : (
          <>
            {colIds.length === 0 && (
              <p className="m-0 mb-[0.67rem] text-[0.93rem] text-[var(--tinta-3)]">Pilih ruang untuk mulai mengisi hari ini.</p>
            )}
            <div className="overflow-x-auto bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]">
              <div className="grid min-w-max" style={{ gridTemplateColumns: `7.5rem repeat(${Math.max(colIds.length, 1)}, minmax(15rem, 1fr))` }}>
                <div className="px-[0.53rem] py-[0.4rem] bg-[var(--cekung)] text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">Waktu</div>
                {colIds.length === 0 && <div className="bg-[var(--cekung)]" />}
                {colIds.map((c) => (
                  <div key={c} className="px-[0.53rem] py-[0.4rem] bg-[var(--cekung)] border-l border-[var(--garis)] text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">
                    {colLabel(c)}
                  </div>
                ))}

                {slots.map((s) => (
                  <Row
                    key={`${s.mulai}-${s.selesai}`}
                    slot={s}
                    colIds={colIds}
                    rows={dayRows.filter((d) => d.jam_mulai === s.mulai && d.jam_selesai === s.selesai)}
                    colOf={colOf}
                    sidang={sidang}
                    name={name}
                    severity={severity}
                    matchIds={matchIds}
                    canEdit={canEdit}
                    onOpen={open}
                  />
                ))}
              </div>
            </div>

            {canEdit && (
              <div className="mt-[0.8rem]">
                {sidang ? (
                  freeRooms.length > 0 && (
                    <Select
                      value=""
                      onValueChange={(v) => v !== ADD_ROOM && setExtraCols((c) => [...c, v])}
                      placeholder="+ Ruang"
                      ariaLabel="Tambah ruang"
                      options={freeRooms}
                      className={CONTROL}
                    />
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setExtraCols((c) => [...c, String(colIds.length + 1)])}
                    className="px-[0.8rem] py-[0.33rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] bg-[var(--cekung)] text-[0.93rem] cursor-pointer hover:bg-[var(--lembar)] transition-colors"
                  >
                    + Kelompok
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {draft && (
        <DefenseFormModal
          // A different row (or slot) is a fresh form.
          key={`${draft.row?.id ?? 'new'}-${draft.tanggal}-${draft.jam_mulai}-${draft.room_id}-${draft.kelompok}`}
          context={context}
          draft={draft}
          lecturers={lecturers}
          rooms={rooms}
          sesi={sesi}
          externalNames={externalNames}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  )
}

function Row({
  slot,
  colIds,
  rows,
  colOf,
  sidang,
  name,
  severity,
  matchIds,
  canEdit,
  onOpen,
}: {
  slot: { mulai: string; selesai: string }
  colIds: string[]
  rows: DefenseRow[]
  colOf: (d: DefenseRow) => string | null
  sidang: boolean
  name: (kode: string | null) => string
  severity: Map<string, 'blok' | 'peringatan'>
  matchIds: Set<string>
  canEdit: boolean
  onOpen: (row: DefenseRow | null, slot?: { mulai: string; selesai: string }, col?: string) => void
}) {
  return (
    <>
      <div className="mono px-[0.53rem] py-[0.53rem] border-t border-[var(--garis)] text-[0.87rem] text-[var(--tinta-2)] whitespace-nowrap">{slotLabel(slot.mulai, slot.selesai)}</div>
      {colIds.length === 0 && <div className="border-t border-[var(--garis)]" />}
      {colIds.map((c) => {
        const here = rows.filter((d) => colOf(d) === c)
        return (
          <div key={c} className="min-h-[5rem] border-t border-l border-[var(--garis)] p-[0.27rem] space-y-[0.27rem]">
            {here.length === 0 ? (
              canEdit ? (
                <button
                  type="button"
                  onClick={() => onOpen(null, slot, c)}
                  className="w-full min-h-[4.4rem] rounded-[var(--r-kecil)] bg-transparent border-0 text-[0.87rem] text-[var(--tinta-3)] cursor-pointer hover:bg-[var(--cekung)] transition-colors"
                >
                  + Isi
                </button>
              ) : (
                <span className="text-[var(--tinta-3)]">—</span>
              )
            ) : (
              here.map((d) => <Card key={d.id} d={d} sidang={sidang} name={name} sev={severity.get(d.id)} matched={matchIds.has(d.id)} onClick={canEdit ? () => onOpen(d) : undefined} />)
            )}
          </div>
        )
      })}
    </>
  )
}

function Card({
  d,
  sidang,
  name,
  sev,
  matched,
  onClick,
}: {
  d: DefenseRow
  sidang: boolean
  name: (kode: string | null) => string
  sev: 'blok' | 'peringatan' | undefined
  matched: boolean
  onClick?: () => void
}) {
  const tone = sev === 'blok' ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)]' : sev === 'peringatan' ? 'bg-[var(--kuning-lembut)] border-[var(--kuning-garis)]' : 'bg-[var(--lembar)] border-[var(--garis)]'
  const roles: [string, string][] = sidang
    ? [
        ['K', name(d.penguji_kode)],
        ['P I', d.penguji_eksternal || '—'],
        ['P II', name(d.pembimbing_kode)],
      ]
    : [
        ['Pembimbing', name(d.pembimbing_kode)],
        ['Pembahas', name(d.penguji_kode)],
      ]
  const body = (
    <>
      <div className="flex items-baseline gap-[0.4rem]">
        <span className="mono text-[0.8rem] text-[var(--tinta-3)]">{d.npm}</span>
        <span className="text-[0.93rem] font-medium text-[var(--tinta)]">{d.nama_mahasiswa}</span>
      </div>
      {d.judul_skripsi && <p className="m-0 text-[0.8rem] text-[var(--tinta-2)] line-clamp-2">{d.judul_skripsi}</p>}
      <p className="m-0 mt-[0.2rem] text-[0.8rem] text-[var(--tinta-2)]">
        {roles.map(([label, who], i) => (
          <span key={label}>
            {i > 0 && ' · '}
            <span className="text-[var(--tinta-3)]">{label}</span> {who}
          </span>
        ))}
      </p>
    </>
  )
  const cls = `w-full text-left rounded-[var(--r-kecil)] border p-[0.4rem] ${tone} ${matched ? 'outline outline-2 outline-[var(--biru)]' : ''}`
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:bg-[var(--cekung)] transition-colors`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
