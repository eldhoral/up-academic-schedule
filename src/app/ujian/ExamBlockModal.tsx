'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { PersonField, type PersonValue } from '@/components/PersonField'
import { Select } from '@/components/Select'
import { hariFromTanggal, hariLabel } from '@/lib/hari'
import {
  checkExamBlockClashes,
  deleteExamBlockAction,
  saveExamBlockAction,
  type ExamBlockInput,
  type ExamClashResult,
  type ExamClashSummary,
} from './actions'
import { GABUNGAN, KETERANGAN_LABEL, KETERANGAN_UJIAN, needsRoom, shortDate, type ExamContext, type ExamView, type KeteranganUjian } from './exam-types'

type Option = { value: string; label: string }
type RowState = { kelas: string; room_id: string; pengawas: PersonValue[] }

const CONTROL = 'w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]'
const NO_ROOM = '__none__'
const CLASH_LABEL = { pengawas: 'Pengawas', ruangan: 'Ruangan', kelas: 'Kelas' }
const UJIAN_LABEL = { uts: 'UTS', uas: 'UAS' }
const dot = (t: string) => t.replace(':', '.')

const toRowState = (r: ExamView): RowState => ({ kelas: r.kelas, room_id: r.room_id ?? '', pengawas: r.pengawas })

export function ExamBlockModal({
  context,
  kode_mk,
  nama_mk,
  sks,
  rows,
  kelasChoices,
  lecturers,
  rooms,
  sesi,
  fixedNames,
  onClose,
}: {
  context: ExamContext
  kode_mk: string
  nama_mk: string
  sks: number | null
  rows: ExamView[]
  kelasChoices: string[]
  lecturers: Option[]
  rooms: Option[]
  sesi: { mulai: string; selesai: string }[]
  fixedNames: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const head = rows[0]
  const [tanggal, setTanggal] = useState(head.tanggal ?? '')
  const [jamMulai, setJamMulai] = useState(head.jam_mulai?.slice(0, 5) ?? '')
  const [jamSelesai, setJamSelesai] = useState(head.jam_selesai?.slice(0, 5) ?? '')
  const [keterangan, setKeterangan] = useState<KeteranganUjian>(head.keterangan_ujian)
  const [rowState, setRowState] = useState<RowState[]>(rows.map(toRowState))

  const [live, setLive] = useState<ExamClashResult | null>(null)
  const [, startCheck] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [needsOverride, setNeedsOverride] = useState<ExamClashSummary[] | null>(null)
  const [overrideConfirmed, setOverrideConfirmed] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const gabungan = rowState.length === 1 && rowState[0].kelas === GABUNGAN
  const room = needsRoom(keterangan)
  const complete = !!(tanggal && jamMulai && jamSelesai)

  function buildInput(): ExamBlockInput {
    return {
      context,
      kode_mk,
      tanggal,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      keterangan_ujian: keterangan,
      rows: rowState.map((r) => ({
        kelas: r.kelas,
        room_id: r.room_id || null,
        pengawas: r.pengawas.filter((p): p is NonNullable<PersonValue> => !!p && ('kode_dosen' in p ? !!p.kode_dosen : !!p.nama.trim())),
      })),
      confirmOverride: overrideConfirmed,
      overrideReason,
    }
  }

  useEffect(() => {
    if (!complete) return
    const t = setTimeout(() => startCheck(async () => setLive(await checkExamBlockClashes(buildInput()))), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, tanggal, jamMulai, jamSelesai, keterangan, JSON.stringify(rowState)])

  function patchRow(i: number, patch: Partial<RowState>) {
    setRowState((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function toggleGabungan(on: boolean) {
    const first = rowState[0]
    if (on) return setRowState([{ kelas: GABUNGAN, room_id: first.room_id, pengawas: first.pengawas }])
    setRowState(
      kelasChoices.map((k, i) => {
        const was = rows.find((r) => r.kelas === k)
        return was ? toRowState(was) : { kelas: k, room_id: i === 0 ? first.room_id : '', pengawas: i === 0 ? first.pengawas : [] }
      }),
    )
  }

  function save() {
    setError(null)
    startSave(async () => {
      const res = await saveExamBlockAction(buildInput())
      if ('error' in res) setError(res.error)
      else if ('needsOverride' in res) setNeedsOverride(res.clashes)
      else {
        router.refresh()
        onClose()
      }
    })
  }

  const visibleClashes = needsOverride ?? (complete ? live?.clashes : null) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Ubah jadwal ${nama_mk}`}>
      <div className="w-full max-w-[40rem] my-[2rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold">
          {UJIAN_LABEL[context.jenis_ujian]} &middot; {nama_mk}
        </h3>
        <p className="m-0 mt-[0.13rem] mb-[1rem] mono text-[0.87rem] text-[var(--tinta-3)]">
          {kode_mk}
          {sks !== null && ` · ${sks} SKS`} &middot; Semester {context.semester_ke}
        </p>

        {error && (
          <div role="alert" className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah-teks)] mb-[1rem]">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="space-y-[1rem]"
        >
          <div className="grid gap-[1rem] sm:grid-cols-2">
            <Field label="Tanggal">
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${CONTROL} mono`} />
              {tanggal && <p className="m-0 mt-[0.2rem] text-[0.8rem] text-[var(--tinta-3)]">{hariLabel(hariFromTanggal(tanggal))}</p>}
            </Field>
            <Field label="Keterangan">
              <Select
                value={keterangan}
                onValueChange={(v) => setKeterangan(v as KeteranganUjian)}
                ariaLabel="Keterangan ujian"
                options={KETERANGAN_UJIAN.map((k) => ({ value: k, label: KETERANGAN_LABEL[k] }))}
                className={CONTROL}
              />
            </Field>
          </div>

          <Field label="Jam">
            {sesi.length > 0 && (
              <div className="flex flex-wrap gap-[0.4rem] mb-[0.4rem]">
                {sesi.map((s) => {
                  const active = s.mulai === jamMulai && s.selesai === jamSelesai
                  return (
                    <button
                      key={`${s.mulai}-${s.selesai}`}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setJamMulai(s.mulai)
                        setJamSelesai(s.selesai)
                      }}
                      className={`mono px-[0.6rem] py-[0.27rem] min-h-[2.2rem] rounded-[var(--r-kecil)] border text-[0.87rem] cursor-pointer transition-colors ${
                        active ? 'bg-[var(--biru-lembut)] border-[var(--biru)] text-[var(--biru)] font-medium' : 'bg-[var(--cekung)] border-[var(--garis-kuat)] text-[var(--tinta-2)] hover:bg-[var(--lembar)]'
                      }`}
                    >
                      {dot(s.mulai)}–{dot(s.selesai)}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex items-center gap-[0.53rem]">
              <input type="time" aria-label="Jam mulai" value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} className={`${CONTROL} mono`} />
              <span aria-hidden="true">–</span>
              <input type="time" aria-label="Jam selesai" value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} className={`${CONTROL} mono`} />
            </div>
          </Field>

          {(kelasChoices.length > 1 || gabungan) && (
            <label className="flex items-center gap-[0.4rem] text-[0.87rem] text-[var(--tinta-2)]">
              <input
                type="checkbox"
                checked={gabungan}
                disabled={gabungan && kelasChoices.length === 0}
                onChange={(e) => toggleGabungan(e.target.checked)}
                className="w-[1rem] h-[1rem]"
              />
              Gabungkan semua kelas (satu ujian bersama, kelas GABUNGAN)
            </label>
          )}

          {rowState.map((r, i) => {
            const dosen = rows.find((x) => x.kelas === r.kelas)?.dosen
            return (
              <fieldset key={r.kelas} className="m-0 border border-[var(--garis)] rounded-[var(--r-kecil)] p-[0.8rem] space-y-[0.67rem]">
                <legend className="px-[0.4rem] text-[0.87rem] font-semibold">
                  {r.kelas === GABUNGAN ? 'Kelas GABUNGAN' : `Kelas ${r.kelas}`}
                </legend>
                {dosen && (
                  <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
                    Dosen pengampu: <span className="text-[var(--tinta-2)]">{dosen.length > 0 ? dosen.join(', ') : 'MKWU'}</span>
                  </p>
                )}

                <Field label="Pengawas">
                  <div className="space-y-[0.4rem]">
                    {r.pengawas.map((p, j) => (
                      <div key={j} className="flex items-start gap-[0.4rem]">
                        <div className="flex-1">
                          <PersonField
                            value={p}
                            ariaLabel={`Pengawas ${j + 1} kelas ${r.kelas}`}
                            dosen={lecturers}
                            fixedNames={fixedNames}
                            onChange={(next) => patchRow(i, { pengawas: r.pengawas.map((x, k) => (k === j ? next : x)) })}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={`Hapus pengawas ${j + 1}`}
                          onClick={() => patchRow(i, { pengawas: r.pengawas.filter((_, k) => k !== j) })}
                          className="min-w-[2.4rem] min-h-[2.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[var(--tinta-2)] cursor-pointer hover:bg-[var(--cekung)]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => patchRow(i, { pengawas: [...r.pengawas, null] })}
                      className="bg-transparent border-0 p-0 text-[0.87rem] text-[var(--biru)] hover:underline cursor-pointer"
                    >
                      + pengawas
                    </button>
                  </div>
                </Field>

                {room && (
                  <Field label="Ruangan">
                    <Select
                      value={r.room_id || ''}
                      onValueChange={(v) => patchRow(i, { room_id: v === NO_ROOM ? '' : v })}
                      placeholder="— pilih ruangan —"
                      ariaLabel={`Ruangan kelas ${r.kelas}`}
                      options={[{ value: NO_ROOM, label: '— tanpa ruangan —' }, ...rooms]}
                      className={CONTROL}
                    />
                  </Field>
                )}
              </fieldset>
            )
          })}

          {visibleClashes.length > 0 && <ClashList clashes={visibleClashes} />}

          {needsOverride && (
            <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.8rem] space-y-[0.6rem]">
              <p className="m-0 text-[0.87rem] text-[var(--merah-teks)] font-medium">
                Penyimpanan diblokir oleh {needsOverride.filter((c) => c.policy === 'blok').length} bentrokan.
              </p>
              <label className="flex items-start gap-[0.4rem] text-[0.87rem]">
                <input type="checkbox" checked={overrideConfirmed} onChange={(e) => setOverrideConfirmed(e.target.checked)} className="mt-[0.2rem] w-[1rem] h-[1rem]" />
                Tetap simpan — jadwal ujian ini sudah benar sesuai yang dimasukkan.
              </label>
              {overrideConfirmed && (
                <input
                  type="text"
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Alasan menerobos bentrokan ini…"
                  className="w-full bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.87rem]"
                />
              )}
            </div>
          )}

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem] border-t border-[var(--garis)]">
            <ConfirmDeleteButton
              onConfirm={async () => {
                const res = await deleteExamBlockAction(context, kode_mk)
                if (res && 'error' in res) return setError(res.error)
                router.refresh()
                onClose()
              }}
            />
            <div className="flex gap-[0.6rem] ml-auto">
              <button type="button" onClick={onClose} className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]">
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
              >
                {isSaving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function ClashList({ clashes }: { clashes: ExamClashSummary[] }) {
  return (
    <ul className="m-0 pl-0 list-none space-y-[0.4rem]">
      {clashes.map((c, i) => (
        <li
          key={i}
          className={`text-[0.87rem] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] border ${
            c.policy === 'blok' ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)] text-[var(--merah-teks)]' : 'bg-[var(--kuning-lembut)] border-[var(--kuning-garis)] text-[var(--kuning)]'
          }`}
        >
          <span className="font-medium">{CLASH_LABEL[c.type]}</span> bentrok dengan <b>{c.nama_mk}</b> (Kelas {c.kelas}
          {c.detail ? `, ${c.detail}` : ''}) — {hariLabel(hariFromTanggal(c.tanggal))} {shortDate(c.tanggal)} {c.jam_mulai}–{c.jam_selesai}, tumpang tindih {c.overlapMinutes} menit.
        </li>
      ))}
    </ul>
  )
}

// A plain div, not <label>: pengawas holds several controls, and a <label> may wrap only one.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </div>
  )
}
