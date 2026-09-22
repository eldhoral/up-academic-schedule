'use client'

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { lecturerDisplayName } from '@/lib/import/tables'
import { createScheduleAction, deleteScheduleAction, updateScheduleAction, type FormState } from './penjadwalan-actions'
import { checkScheduleClashes, type ClashCheckResult } from './clash-actions'
import { HARI_DB as HARI, hariLabel } from '@/lib/hari'
import type { Course, Lecturer, Room, ScheduleRow, SessionRow } from './penjadwalan-types'

const CLASH_LABEL: Record<string, string> = { dosen: 'Dosen', kelas: 'Kelas', ruangan: 'Ruangan' }

export function ScheduleFormModal({
  context,
  courses,
  lecturers,
  rooms,
  sessions,
  kelasOptions,
  defaultZoomId,
  maksMahasiswaPerKelas,
  minMahasiswaPilihan,
  editing,
  onClose,
  onSaved,
}: {
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
  courses: Course[]
  lecturers: Lecturer[]
  rooms: Room[]
  sessions: SessionRow[]
  kelasOptions: string[]
  defaultZoomId: string
  maksMahasiswaPerKelas: number
  minMahasiswaPilihan: number
  editing: ScheduleRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const action = editing ? updateScheduleAction.bind(null, editing.id) : createScheduleAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onSaved()
    }
  }, [state, router, onSaved])

  const [showAllCourses, setShowAllCourses] = useState(!!editing)
  const [kodeMk, setKodeMk] = useState(editing?.kode_mk ?? '')
  const selectedCourse = courses.find((c) => c.kode_mk === kodeMk) ?? null

  const visibleCourses = useMemo(() => {
    const scoped = showAllCourses ? courses : courses.filter((c) => c.smt === context.semester_ke)
    return scoped.length > 0 ? scoped : courses
  }, [courses, showAllCourses, context.semester_ke])

  const [sesiMode, setSesiMode] = useState<'terjadwal' | 'bebas'>(editing ? 'bebas' : 'terjadwal')
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [sesiId, setSesiId] = useState('')
  const [hari, setHari] = useState(editing?.hari ?? '')
  const [jamMulai, setJamMulai] = useState(editing?.jam_mulai?.slice(0, 5) ?? '')
  const [jamSelesai, setJamSelesai] = useState(editing?.jam_selesai?.slice(0, 5) ?? '')

  const activeSessions = sessions.filter((s) => s.active)
  const visibleSessions =
    showAllSessions || !selectedCourse ? activeSessions : activeSessions.filter((s) => s.sks === selectedCourse.sks)

  function pickSesi(id: string) {
    setSesiId(id)
    const s = sessions.find((x) => x.id === id)
    if (s) {
      setHari(s.hari)
      setJamMulai(s.jam_mulai.slice(0, 5))
      setJamSelesai(s.jam_selesai.slice(0, 5))
    }
  }

  const [dosenRows, setDosenRows] = useState<string[]>(
    editing?.schedule_lecturers.length
      ? editing.schedule_lecturers.sort((a, b) => a.urutan - b.urutan).map((sl) => sl.lecturers?.kode_dosen ?? '')
      : []
  )

  const jumlahMhsDefault = editing?.jumlah_mhs ?? 0
  const [jumlahMhs, setJumlahMhs] = useState(jumlahMhsDefault)
  const overCapacity = maksMahasiswaPerKelas > 0 && jumlahMhs > maksMahasiswaPerKelas
  const underPilihan = selectedCourse?.jenis_mk === 'B' && jumlahMhs > 0 && jumlahMhs < minMahasiswaPilihan

  const [kelas, setKelas] = useState(editing?.kelas ?? kelasOptions[0] ?? 'A')
  const [roomId, setRoomId] = useState(editing?.room_id ?? '')
  const [minggu, setMinggu] = useState<'setiap' | 'ganjil' | 'genap'>(editing?.minggu ?? 'setiap')

  const [livePreview, setLivePreview] = useState<ClashCheckResult | null>(null)
  const [isCheckingClash, startClashCheck] = useTransition()
  const [overrideConfirmed, setOverrideConfirmed] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const candidateComplete = !!(hari && jamMulai && jamSelesai && kelas)

  useEffect(() => {
    if (!candidateComplete) return
    const dosenCodes = dosenRows.filter(Boolean)
    startClashCheck(async () => {
      const result = await checkScheduleClashes(context.academic_year_id, {
        id: editing?.id,
        hari,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        minggu,
        kelas,
        jenis_kelas: context.jenis_kelas,
        semester_ke: context.semester_ke,
        room_id: roomId || null,
        dosenCodes,
      })
      setLivePreview(result)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateComplete, hari, jamMulai, jamSelesai, kelas, roomId, minggu, dosenRows.join(',')])

  const needsOverride = state && 'needsOverride' in state ? state : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="w-full max-w-[34rem] my-[2rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">{editing ? 'Edit jadwal' : 'Add course'}</h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[1rem]">
          <input type="hidden" name="academic_year_id" value={context.academic_year_id} />
          <input type="hidden" name="jenis_kelas" value={context.jenis_kelas} />
          <input type="hidden" name="semester_ke" value={context.semester_ke} />
          <input type="hidden" name="hari" value={hari} />
          <input type="hidden" name="jam_mulai" value={jamMulai} />
          <input type="hidden" name="jam_selesai" value={jamSelesai} />

          <Field label="Mata Kuliah">
            <select
              name="kode_mk"
              required
              value={kodeMk}
              onChange={(e) => setKodeMk(e.target.value)}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
            >
              <option value="">— pilih mata kuliah —</option>
              {visibleCourses.map((c) => (
                <option key={c.kode_mk} value={c.kode_mk}>
                  {c.kode_mk} — {c.nama_mk} — {c.sks} SKS
                </option>
              ))}
            </select>
            <label className="mt-[0.3rem] flex items-center gap-[0.4rem] text-[0.8rem] text-[var(--tinta-3)]">
              <input
                type="checkbox"
                checked={showAllCourses}
                onChange={(e) => setShowAllCourses(e.target.checked)}
                className="w-[0.9rem] h-[0.9rem]"
              />
              Tampilkan semua mata kuliah (bukan hanya semester {context.semester_ke})
            </label>
          </Field>

          <Field label="Sesi">
            {sesiMode === 'terjadwal' ? (
              <>
                <select
                  value={sesiId}
                  onChange={(e) => pickSesi(e.target.value)}
                  className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
                >
                  <option value="">— pilih sesi —</option>
                  {visibleSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {hariLabel(s.hari)} · {s.jam_mulai.slice(0, 5)}–{s.jam_selesai.slice(0, 5)} ({s.sks} SKS)
                    </option>
                  ))}
                </select>
                <div className="mt-[0.3rem] flex items-center gap-[1rem] flex-wrap">
                  <label className="flex items-center gap-[0.4rem] text-[0.8rem] text-[var(--tinta-3)]">
                    <input
                      type="checkbox"
                      checked={showAllSessions}
                      onChange={(e) => setShowAllSessions(e.target.checked)}
                      className="w-[0.9rem] h-[0.9rem]"
                    />
                    Tampilkan semua sesi (abaikan SKS)
                  </label>
                  <button
                    type="button"
                    onClick={() => setSesiMode('bebas')}
                    className="text-[0.8rem] text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0"
                  >
                    Waktu bebas →
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-[0.5rem]">
                <div className="flex gap-[0.6rem]">
                  <select
                    value={hari}
                    onChange={(e) => setHari(e.target.value)}
                    required
                    className="flex-1 bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
                  >
                    <option value="">— hari —</option>
                    {HARI.map((h) => (
                      <option key={h} value={h}>
                        {hariLabel(h)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={jamMulai}
                    onChange={(e) => setJamMulai(e.target.value)}
                    required
                    className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono min-h-[2.4rem]"
                  />
                  <input
                    type="time"
                    value={jamSelesai}
                    onChange={(e) => setJamSelesai(e.target.value)}
                    required
                    className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono min-h-[2.4rem]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSesiMode('terjadwal')}
                  className="text-[0.8rem] text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  ← Pilih dari sesi terjadwal
                </button>
              </div>
            )}
          </Field>

          <Field label="Kelas">
            <select
              name="kelas"
              required
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
            >
              {kelasOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Dosen">
            <div className="space-y-[0.5rem]">
              {dosenRows.map((kode, i) => (
                <div key={i} className="flex gap-[0.5rem]">
                  <select
                    name="dosen"
                    value={kode}
                    onChange={(e) => setDosenRows((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="flex-1 bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
                  >
                    <option value="">— pilih dosen —</option>
                    {lecturers.map((l) => (
                      <option key={l.kode_dosen} value={l.kode_dosen}>
                        {lecturerDisplayName(l)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDosenRows((prev) => prev.filter((_, j) => j !== i))}
                    className="px-[0.6rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
                    aria-label="Remove dosen"
                  >
                    ×
                  </button>
                </div>
              ))}
              {dosenRows.length === 0 && (
                <p className="text-[0.8rem] text-[var(--tinta-3)]">
                  No lecturer — prints as <span className="mono">MKWU</span>.
                </p>
              )}
              <button
                type="button"
                onClick={() => setDosenRows((prev) => [...prev, ''])}
                className="px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.8rem] cursor-pointer hover:bg-[var(--cekung)]"
              >
                + Tambah dosen
              </button>
            </div>
          </Field>

          <div className="flex gap-[0.8rem]">
            <Field label="Ruangan" className="flex-1">
              <select
                name="room_id"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zoom ID" className="flex-1">
              <input
                name="zoom_id"
                defaultValue={editing?.zoom_id ?? defaultZoomId}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
            </Field>
          </div>

          <div className="flex gap-[0.8rem]">
            <Field label="Jumlah Mahasiswa" className="flex-1">
              <input
                name="jumlah_mhs"
                type="number"
                min={0}
                value={jumlahMhs}
                onChange={(e) => setJumlahMhs(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
              {overCapacity && (
                <p className="mt-[0.2rem] text-[0.8rem] text-[var(--kuning)]">Above the {maksMahasiswaPerKelas}-student advisory limit.</p>
              )}
              {underPilihan && (
                <p className="mt-[0.2rem] text-[0.8rem] text-[var(--kuning)]">Below the {minMahasiswaPilihan}-student advisory minimum for an elective.</p>
              )}
            </Field>
            {context.jenis_kelas === 'regsus' && (
              <Field label="Minggu" className="flex-1">
                <select
                  name="minggu"
                  value={minggu}
                  onChange={(e) => setMinggu(e.target.value as 'setiap' | 'ganjil' | 'genap')}
                  className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
                >
                  <option value="setiap">Setiap minggu</option>
                  <option value="ganjil">Minggu ganjil (A)</option>
                  <option value="genap">Minggu genap (B)</option>
                </select>
              </Field>
            )}
          </div>

          <input type="hidden" name="confirm_override" value={overrideConfirmed ? 'ya' : 'tidak'} />
          <input type="hidden" name="override_reason" value={overrideReason} />

          {isCheckingClash && <p className="text-[0.8rem] text-[var(--tinta-3)]">Checking for clashes…</p>}

          {candidateComplete && livePreview && livePreview.clashes.length > 0 && (
            <ClashList clashes={livePreview.clashes} />
          )}

          {needsOverride && (
            <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.8rem] space-y-[0.6rem]">
              <p className="text-[0.87rem] text-[var(--merah)] font-medium">
                Saving is blocked by {needsOverride.clashes.filter((c) => c.policy === 'blok').length} clash
                {needsOverride.clashes.filter((c) => c.policy === 'blok').length === 1 ? '' : 'es'}.
              </p>
              <ClashList clashes={needsOverride.clashes} />
              <label className="flex items-start gap-[0.4rem] text-[0.87rem]">
                <input
                  type="checkbox"
                  checked={overrideConfirmed}
                  onChange={(e) => setOverrideConfirmed(e.target.checked)}
                  className="mt-[0.2rem] w-[1rem] h-[1rem]"
                />
                Save anyway — this schedule is correct as entered.
              </label>
              {overrideConfirmed && (
                <input
                  type="text"
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for overriding this clash…"
                  className="w-full bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.87rem]"
                />
              )}
            </div>
          )}

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem] border-t border-[var(--garis)]">
            {editing &&
              (!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
                >
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteScheduleAction(editing.id)
                    router.refresh()
                    onSaved()
                  }}
                  className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer"
                >
                  Confirm delete?
                </button>
              ))}
            <div className="flex gap-[0.6rem] ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClashList({ clashes }: { clashes: { type: string; policy: string; detail: string; nama_mk: string; kelas: string; hari: string; jam_mulai: string; jam_selesai: string; overlapMinutes: number }[] }) {
  return (
    <ul className="m-0 pl-0 list-none space-y-[0.4rem]">
      {clashes.map((c, i) => (
        <li
          key={i}
          className={`text-[0.87rem] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] border ${
            c.policy === 'blok'
              ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)] text-[var(--merah-teks)]'
              : 'bg-[var(--kuning-lembut)] border-[var(--kuning-garis)] text-[var(--kuning)]'
          }`}
        >
          <span className="font-medium">{CLASH_LABEL[c.type] ?? c.type}</span> clash with{' '}
          <b>{c.nama_mk}</b> (Kelas {c.kelas}, {c.detail}) — {hariLabel(c.hari)} {c.jam_mulai.slice(0, 5)}–{c.jam_selesai.slice(0, 5)},{' '}
          {c.overlapMinutes} min overlap.
        </li>
      ))}
    </ul>
  )
}

// A plain div, not <label> — several sections below (Mata Kuliah, Sesi, Dosen)
// hold more than one control, and a <label> may only wrap a single one.
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`block ${className}`}>
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </div>
  )
}
