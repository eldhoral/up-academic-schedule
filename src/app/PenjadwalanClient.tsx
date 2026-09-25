'use client'

import { useState } from 'react'
import { Select } from '@/components/Select'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB, hariLabel } from '@/lib/hari'
import { ScheduleFormModal } from './ScheduleFormModal'
import { ClashFindingsBar } from './ClashFindingsBar'
import type { ClashFinding, ClashFindingSide } from './clash-actions'
import type { AcademicYear, Course, Lecturer, Room, ScheduleRow, SessionRow } from './penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export function PenjadwalanClient({
  academicYears,
  courses,
  lecturers,
  rooms,
  sessions,
  schedules: initialSchedules,
  clashes: initialClashes,
  kelasOptions,
  defaultZoomId,
  maksMahasiswaPerKelas,
  minMahasiswaPilihan,
  context: initialContext,
}: {
  academicYears: AcademicYear[]
  courses: Course[]
  lecturers: Lecturer[]
  rooms: Room[]
  sessions: SessionRow[]
  schedules: ScheduleRow[]
  clashes: ClashFinding[]
  kelasOptions: string[]
  defaultZoomId: string
  maksMahasiswaPerKelas: number
  minMahasiswaPilihan: number
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
}) {
  const [modalOpen, setModalOpen] = useState<'new' | ScheduleRow | null>(null)
  const [schedules, setSchedules] = useState(initialSchedules)
  const [clashes, setClashes] = useState(initialClashes)
  const [context, setContext] = useState(initialContext)
  const [query, setQuery] = useState('')
  const [hariFilter, setHariFilter] = useState('semua')

  // router.refresh() (after add/edit save) re-renders the server page with fresh props — resync.
  // (React "adjusting state during render" pattern: avoids an effect + extra render pass.)
  const [prevInitial, setPrevInitial] = useState({
    schedules: initialSchedules,
    clashes: initialClashes,
    context: initialContext,
  })
  if (
    initialSchedules !== prevInitial.schedules ||
    initialClashes !== prevInitial.clashes ||
    initialContext !== prevInitial.context
  ) {
    setPrevInitial({ schedules: initialSchedules, clashes: initialClashes, context: initialContext })
    setSchedules(initialSchedules)
    setClashes(initialClashes)
    setContext(initialContext)
  }

  async function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    const yearChanged = merged.academic_year_id !== context.academic_year_id
    setContext(merged)
    window.history.replaceState(null, '', `/?${params.toString()}`)

    const schedulesPromise = fetch(`/api/schedules?${params.toString()}`).then((r) => r.json())
    // Clashes are scoped to the whole academic year, not the semester/kelas filter — only refetch when the year changes.
    const clashesPromise = yearChanged
      ? fetch(`/api/clashes?ay=${merged.academic_year_id}`).then((r) => r.json())
      : null

    setSchedules(await schedulesPromise)
    if (clashesPromise) setClashes(await clashesPromise)
  }

  async function viewClashSide(side: ClashFindingSide) {
    const needsNav = side.jenis_kelas !== context.jenis_kelas || side.semester_ke !== context.semester_ke
    if (needsNav) {
      await navigate({ jenis_kelas: side.jenis_kelas as 'reguler' | 'regsus', semester_ke: side.semester_ke })
    }
    // rAF: wait a paint past the state update above so the target kelas group exists in the DOM.
    requestAnimationFrame(() => {
      document.getElementById(`kelas-${side.kelas}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const dosenText = (s: ScheduleRow) =>
    s.schedule_lecturers.length === 0
      ? 'MKWU'
      : s.schedule_lecturers.map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : '')).join(' ')
  const q = query.trim().toLowerCase()
  const filtered = schedules.filter((s) => {
    if (hariFilter !== 'semua' && s.hari !== hariFilter) return false
    if (!q) return true
    return [s.kode_mk, s.courses?.nama_mk, dosenText(s), s.rooms?.nama, s.zoom_id].some((v) =>
      v?.toLowerCase().includes(q),
    )
  })

  const byKelas = new Map<string, ScheduleRow[]>()
  for (const s of filtered) {
    const list = byKelas.get(s.kelas) ?? []
    list.push(s)
    byKelas.set(s.kelas, list)
  }
  const kelasGroups = Array.from(byKelas.entries()).sort(([a], [b]) => a.localeCompare(b))

  const totalSks = schedules.reduce((sum, s) => sum + (s.courses?.sks ?? 0), 0)
  const totalMhs = schedules.reduce((sum, s) => sum + s.jumlah_mhs, 0)

  return (
    <div>
      <div className="sticky top-[3.4rem] z-10 min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Program
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <span className="ml-auto text-[0.87rem] text-[var(--tinta-3)]">
          {schedules.length} baris &middot; {totalSks} SKS &middot; {totalMhs} mahasiswa
        </span>
      </div>

      <div className="p-[1.07rem_1.3rem_1.3rem]">
        <ClashFindingsBar
          clashes={clashes}
          academicYearLabel={academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? 'tahun ini'}
          onView={viewClashSide}
        />

        <div className="flex items-end justify-between gap-[1rem] mb-[1rem] flex-wrap">
          <div>
            <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.015em]">
              Semester {context.semester_ke} &middot; {context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'}
            </h1>
            <p className="mt-[0.27rem] text-[0.93rem] text-[var(--tinta-3)]">
              Pilih mata kuliah di sebelah kanan; tabel akan bertambah di bawah, dikelompokkan per kelas.
            </p>
          </div>
          <div className="flex items-center gap-[0.53rem] flex-wrap">
            <input
              type="search"
              placeholder="Cari kode, mata kuliah, dosen, ruangan…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-[18rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.5rem]"
            />
            <Select
              ariaLabel="Filter hari"
              value={hariFilter}
              onValueChange={setHariFilter}
              options={[
                { value: 'semua', label: 'Semua hari' },
                ...HARI_DB.map((h) => ({ value: h, label: hariLabel(h) })),
              ]}
              className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.5rem]"
            />
            <button
              type="button"
              onClick={() => setModalOpen('new')}
              className="px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
            >
              Tambah mata kuliah
            </button>
          </div>
        </div>

        {schedules.length > 0 && kelasGroups.length === 0 && (
          <p className="text-[0.93rem] text-[var(--tinta-3)] py-[2rem] text-center">
            Tidak ada jadwal yang cocok dengan pencarian.
          </p>
        )}

        {schedules.length === 0 && (
          <p className="text-[0.93rem] text-[var(--tinta-3)] py-[2rem] text-center">
            Belum ada jadwal untuk semester ini &mdash; tambahkan mata kuliah pertama.
          </p>
        )}

        <div className="space-y-[1.6rem]">
          {kelasGroups.map(([kelas, rows]) => {
            const subtotal = rows.reduce((sum, r) => sum + (r.courses?.sks ?? 0), 0)
            return (
              <div key={kelas} id={`kelas-${kelas}`}>
                <h2 className="text-[0.93rem] font-semibold text-[var(--tinta-2)] mb-[0.4rem]">
                  Kelas {kelas} <span className="font-normal text-[var(--tinta-3)]">&middot; {subtotal} SKS</span>
                </h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th style={{ width: '7rem' }}>Kode</Th>
                      <Th>Mata Kuliah</Th>
                      <Th style={{ width: '3.6rem', textAlign: 'center' }}>SKS</Th>
                      <Th style={{ width: '7rem' }}>Hari</Th>
                      <Th style={{ width: '8rem' }}>Waktu</Th>
                      <Th style={{ width: '17rem' }}>Dosen</Th>
                      <Th style={{ width: '5rem' }}>Ruangan</Th>
                      <Th style={{ width: '6rem' }}>Zoom</Th>
                      <Th style={{ width: '3rem' }}>&nbsp;</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .sort((a, b) => a.hari.localeCompare(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
                      .map((r) => (
                        <tr
                          key={r.id}
                          className={`border-b border-[var(--garis)] hover:bg-[var(--cekung)] transition-colors ${
                            r.is_override ? 'bg-[var(--merah-lembut)] hover:bg-[#FBE6E2]' : ''
                          }`}
                        >
                          <Td className="mono" style={{ color: 'var(--tinta-2)', fontSize: '.93rem' }}>
                            {r.kode_mk}
                          </Td>
                          <Td>
                            {r.courses?.nama_mk ?? r.kode_mk}
                            {r.is_override && (
                              <span
                                className="ml-[0.4rem] inline-block text-[0.8rem] px-[0.47rem] py-[0.07rem] rounded-full border border-[var(--merah-garis)] text-[var(--merah)] bg-[var(--lembar)]"
                                title={r.override_reason || 'Bentrokan diterobos'}
                              >
                                Diterobos
                              </span>
                            )}
                          </Td>
                          <Td className="mono" style={{ textAlign: 'center' }}>
                            {r.courses?.sks ?? '—'}
                          </Td>
                          <Td>{hariLabel(r.hari)}</Td>
                          <Td className="mono" style={{ fontSize: '.93rem' }}>
                            {r.jam_mulai.slice(0, 5)}–{r.jam_selesai.slice(0, 5)}
                          </Td>
                          <Td>
                            {r.schedule_lecturers.length === 0 ? (
                              <span className="inline-block text-[0.8rem] px-[0.47rem] py-[0.07rem] rounded-full border border-[var(--garis-kuat)] text-[var(--tinta-2)] bg-[var(--cekung)]">
                                MKWU
                              </span>
                            ) : (
                              r.schedule_lecturers
                                .sort((a, b) => a.urutan - b.urutan)
                                .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : '—'))
                                .join(', ')
                            )}
                          </Td>
                          <Td className="mono" style={{ color: 'var(--tinta-3)', fontSize: '.93rem' }}>
                            {r.rooms?.nama ?? '—'}
                          </Td>
                          <Td className="mono" style={{ color: 'var(--tinta-3)', fontSize: '.93rem' }}>
                            {r.zoom_id || '—'}
                          </Td>
                          <Td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setModalOpen(r)}
                              className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                            >
                              Ubah
                            </button>
                          </Td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </div>

      {modalOpen && (
        <ScheduleFormModal
          context={context}
          courses={courses}
          lecturers={lecturers}
          rooms={rooms}
          sessions={sessions}
          kelasOptions={kelasOptions}
          defaultZoomId={defaultZoomId}
          maksMahasiswaPerKelas={maksMahasiswaPerKelas}
          minMahasiswaPilihan={minMahasiswaPilihan}
          editing={modalOpen === 'new' ? null : modalOpen}
          onClose={() => setModalOpen(null)}
          onSaved={() => setModalOpen(null)}
        />
      )}
    </div>
  )
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={style}
      className="text-left px-[0.53rem] pt-0 pb-[0.47rem] text-[0.8rem] font-medium text-[var(--tinta-3)] border-b border-[var(--garis-kuat)] whitespace-nowrap"
    >
      {children}
    </th>
  )
}

function Td({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <td style={style} className={`px-[0.53rem] py-[0.27rem] h-[2.6rem] border-b border-[var(--garis)] text-[1rem] ${className}`}>
      {children}
    </td>
  )
}
