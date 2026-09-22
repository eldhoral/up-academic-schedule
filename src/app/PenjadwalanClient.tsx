'use client'

import { useState } from 'react'
import { lecturerDisplayName } from '@/lib/import/tables'
import { hariLabel } from '@/lib/hari'
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

  function viewClashSide(side: ClashFindingSide) {
    navigate({ jenis_kelas: side.jenis_kelas as 'reguler' | 'regsus', semester_ke: side.semester_ke })
  }

  const byKelas = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    const list = byKelas.get(s.kelas) ?? []
    list.push(s)
    byKelas.set(s.kelas, list)
  }
  const kelasGroups = Array.from(byKelas.entries()).sort(([a], [b]) => a.localeCompare(b))

  const totalSks = schedules.reduce((sum, s) => sum + (s.courses?.sks ?? 0), 0)
  const totalMhs = schedules.reduce((sum, s) => sum + s.jumlah_mhs, 0)

  return (
    <div>
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Academic year
        </label>
        <select
          id="ctx-ay"
          value={context.academic_year_id}
          onChange={(e) => navigate({ academic_year_id: e.target.value })}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        >
          {academicYears.map((ay) => (
            <option key={ay.id} value={ay.id}>
              {ay.label}
            </option>
          ))}
        </select>

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Program
        </label>
        <select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onChange={(e) => navigate({ jenis_kelas: e.target.value as 'reguler' | 'regsus' })}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        >
          <option value="reguler">Reguler</option>
          <option value="regsus">Reguler Khusus</option>
        </select>

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <select
          id="ctx-smt"
          value={context.semester_ke}
          onChange={(e) => navigate({ semester_ke: parseInt(e.target.value, 10) })}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        >
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <span className="ml-auto text-[0.87rem] text-[var(--tinta-3)]">
          {schedules.length} row{schedules.length === 1 ? '' : 's'} &middot; {totalSks} SKS &middot; {totalMhs} students
        </span>
      </div>

      <div className="p-[1.07rem_1.3rem_1.3rem]">
        <ClashFindingsBar
          clashes={clashes}
          academicYearLabel={academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? 'this year'}
          onView={viewClashSide}
        />

        <div className="flex items-end justify-between gap-[1rem] mb-[1rem] flex-wrap">
          <div>
            <h1 className="m-0 text-[1.6rem] font-semibold tracking-[-0.015em]">
              Semester {context.semester_ke} &middot; {context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'}
            </h1>
            <p className="mt-[0.27rem] text-[0.93rem] text-[var(--tinta-3)]">
              Pick a course on the right; the table grows below, grouped by kelas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen('new')}
            className="px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
          >
            Add course
          </button>
        </div>

        {kelasGroups.length === 0 && (
          <p className="text-[0.93rem] text-[var(--tinta-3)] py-[2rem] text-center">
            No schedule rows yet for this semester &mdash; add the first course.
          </p>
        )}

        <div className="space-y-[1.6rem]">
          {kelasGroups.map(([kelas, rows]) => {
            const subtotal = rows.reduce((sum, r) => sum + (r.courses?.sks ?? 0), 0)
            return (
              <div key={kelas}>
                <h2 className="text-[0.93rem] font-semibold text-[var(--tinta-2)] mb-[0.4rem]">
                  Kelas {kelas} <span className="font-normal text-[var(--tinta-3)]">&middot; {subtotal} SKS</span>
                </h2>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th style={{ width: '7rem' }}>Code</Th>
                      <Th>Course</Th>
                      <Th style={{ width: '3.6rem', textAlign: 'center' }}>SKS</Th>
                      <Th style={{ width: '7rem' }}>Day</Th>
                      <Th style={{ width: '8rem' }}>Time</Th>
                      <Th style={{ width: '17rem' }}>Lecturer</Th>
                      <Th style={{ width: '5rem' }}>Room</Th>
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
                                title={r.override_reason || 'Overridden clash'}
                              >
                                Overridden
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
                          <Td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setModalOpen(r)}
                              className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                            >
                              Edit
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
