'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { Select } from '@/components/Select'
import { hariFromTanggal, hariLabel } from '@/lib/hari'
import {
  checkDefenseClashes,
  deleteDefenseAction,
  lookupMahasiswaAction,
  saveDefenseAction,
  type DefenseClashResult,
  type DefenseClashSummary,
  type DefenseInput,
} from './actions'
import { JENIS_LABEL, tanggalSingkat, type DefenseContext, type DefenseRow } from './defense-types'

type Option = { value: string; label: string }
export type DefenseDraft = {
  row: DefenseRow | null // set when editing
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  room_id: string
  kelompok: number | null
}

const CONTROL = 'w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]'
const NONE = '__none__'
const CLASH_LABEL = { dosen: 'Dosen', eksternal: 'Penguji eksternal', ruangan: 'Ruang', mengajar: 'Jadwal mengajar' }
const dot = (t: string) => t.replace(':', '.')

export function DefenseFormModal({
  context,
  draft,
  lecturers,
  rooms,
  sesi,
  externalNames,
  onClose,
}: {
  context: DefenseContext
  draft: DefenseDraft
  lecturers: Option[]
  rooms: Option[]
  sesi: { mulai: string; selesai: string }[]
  externalNames: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const { row } = draft
  const sidang = context.jenis === 'sidang'

  const [tanggal, setTanggal] = useState(draft.tanggal)
  const [jamMulai, setJamMulai] = useState(draft.jam_mulai)
  const [jamSelesai, setJamSelesai] = useState(draft.jam_selesai)
  const [roomId, setRoomId] = useState(draft.room_id)
  const [kelompok, setKelompok] = useState<number | null>(draft.kelompok)
  const [npm, setNpm] = useState(row?.npm ?? '')
  const [nama, setNama] = useState(row?.nama_mahasiswa ?? '')
  const [judul, setJudul] = useState(row?.judul_skripsi ?? '')
  const [pembimbing, setPembimbing] = useState(row?.pembimbing_kode ?? '')
  const [penguji, setPenguji] = useState(row?.penguji_kode ?? '')
  const [eksternal, setEksternal] = useState(row?.penguji_eksternal ?? '')
  const [filledFrom, setFilledFrom] = useState<string | null>(null)

  const [live, setLive] = useState<DefenseClashResult | null>(null)
  const [, startCheck] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [needsOverride, setNeedsOverride] = useState<DefenseClashSummary[] | null>(null)
  const [overrideConfirmed, setOverrideConfirmed] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const complete = !!(tanggal && jamMulai && jamSelesai)

  function buildInput(): DefenseInput {
    return {
      id: row?.id ?? null,
      academic_year_id: context.academic_year_id,
      jenis: context.jenis,
      tanggal,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      room_id: roomId || null,
      kelompok,
      npm,
      nama_mahasiswa: nama,
      judul_skripsi: judul,
      pembimbing_kode: pembimbing || null,
      penguji_kode: penguji || null,
      penguji_eksternal: eksternal,
      confirmOverride: overrideConfirmed,
      overrideReason,
    }
  }

  useEffect(() => {
    if (!complete) return
    const t = setTimeout(() => startCheck(async () => setLive(await checkDefenseClashes(buildInput()))), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, tanggal, jamMulai, jamSelesai, roomId, kelompok, pembimbing, penguji, eksternal])

  // A sidang starts from the student's prasidang: fill what is still blank.
  async function lookup() {
    if (row || !npm.trim()) return
    const found = await lookupMahasiswaAction(npm)
    if (!found) return setFilledFrom(null)
    if (!nama.trim()) setNama(found.nama_mahasiswa)
    if (!judul.trim()) setJudul(found.judul_skripsi)
    if (!pembimbing && found.pembimbing_kode) setPembimbing(found.pembimbing_kode)
    setFilledFrom(found.from)
  }

  function save() {
    setError(null)
    startSave(async () => {
      const res = await saveDefenseAction(buildInput())
      if ('error' in res) setError(res.error)
      else if ('needsOverride' in res) setNeedsOverride(res.clashes)
      else {
        router.refresh()
        onClose()
      }
    })
  }

  const visibleClashes = needsOverride ?? (complete ? live?.clashes : null) ?? []
  const dosenOptions = [{ value: NONE, label: '— kosong —' }, ...lecturers]
  const pickDosen = (set: (v: string) => void) => (v: string) => set(v === NONE ? '' : v)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${row ? 'Ubah' : 'Tambah'} ${JENIS_LABEL[context.jenis]}`}>
      <div className="w-full max-w-[38rem] my-[2rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 mb-[1rem] text-[1.1rem] font-semibold">
          {row ? 'Ubah' : 'Tambah'} {JENIS_LABEL[context.jenis]}
        </h3>

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
            {sidang ? (
              <Field label="Ruang">
                <Select value={roomId} onValueChange={setRoomId} placeholder="— pilih ruang —" ariaLabel="Ruang sidang" options={rooms} className={CONTROL} />
              </Field>
            ) : (
              <Field label="Kelompok (breakout room)">
                <input
                  type="number"
                  min={1}
                  value={kelompok ?? ''}
                  onChange={(e) => setKelompok(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className={`${CONTROL} mono`}
                />
              </Field>
            )}
          </div>

          <Field label="Waktu">
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

          <div className="grid gap-[1rem] sm:grid-cols-[10rem_1fr]">
            <Field label="NPM">
              <input
                type="text"
                inputMode="numeric"
                value={npm}
                onChange={(e) => setNpm(e.target.value.replace(/\D/g, ''))}
                onBlur={lookup}
                className={`${CONTROL} mono`}
              />
            </Field>
            <Field label="Nama mahasiswa">
              <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} className={CONTROL} />
            </Field>
          </div>
          {filledFrom && <p className="m-0 -mt-[0.5rem] text-[0.8rem] text-[var(--tinta-3)]">Diisi dari {filledFrom}.</p>}

          <Field label="Judul skripsi">
            <textarea value={judul} onChange={(e) => setJudul(e.target.value)} rows={3} className={`${CONTROL} resize-y`} />
          </Field>

          {sidang ? (
            <>
              <Field label="Ketua sidang">
                <Select value={penguji} onValueChange={pickDosen(setPenguji)} placeholder="— pilih dosen —" ariaLabel="Ketua sidang" options={dosenOptions} className={CONTROL} />
              </Field>
              <Field label="Anggota penguji I (penguji eksternal)">
                <input type="text" list="eksternal-pilihan" value={eksternal} onChange={(e) => setEksternal(e.target.value)} className={CONTROL} />
                {/* Names typed before, and the dosen master: pick or type anyone. */}
                <datalist id="eksternal-pilihan">
                  {[...new Set([...externalNames, ...lecturers.map((l) => l.label)])].map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field label="Anggota penguji II (dosen pembimbing)">
                <Select value={pembimbing} onValueChange={pickDosen(setPembimbing)} placeholder="— pilih dosen —" ariaLabel="Anggota penguji II" options={dosenOptions} className={CONTROL} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Dosen pembimbing pendamping">
                <Select value={pembimbing} onValueChange={pickDosen(setPembimbing)} placeholder="— pilih dosen —" ariaLabel="Dosen pembimbing pendamping" options={dosenOptions} className={CONTROL} />
              </Field>
              <Field label="Dosen pembahas">
                <Select value={penguji} onValueChange={pickDosen(setPenguji)} placeholder="— pilih dosen —" ariaLabel="Dosen pembahas" options={dosenOptions} className={CONTROL} />
              </Field>
            </>
          )}

          {visibleClashes.length > 0 && <ClashList clashes={visibleClashes} />}

          {needsOverride && (
            <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.8rem] space-y-[0.6rem]">
              <p className="m-0 text-[0.87rem] text-[var(--merah-teks)] font-medium">Penyimpanan diblokir oleh {needsOverride.filter((c) => c.policy === 'blok').length} bentrokan.</p>
              <label className="flex items-start gap-[0.4rem] text-[0.87rem]">
                <input type="checkbox" checked={overrideConfirmed} onChange={(e) => setOverrideConfirmed(e.target.checked)} className="mt-[0.2rem] w-[1rem] h-[1rem]" />
                Tetap simpan — jadwal ini sudah benar sesuai yang dimasukkan.
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
            {row ? (
              <ConfirmDeleteButton
                onConfirm={async () => {
                  const res = await deleteDefenseAction(row.id)
                  if ('error' in res) return setError(res.error)
                  router.refresh()
                  onClose()
                }}
              />
            ) : (
              <span />
            )}
            <div className="flex gap-[0.6rem]">
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

function ClashList({ clashes }: { clashes: DefenseClashSummary[] }) {
  return (
    <ul className="m-0 pl-0 list-none space-y-[0.4rem]">
      {clashes.map((c, i) => (
        <li
          key={i}
          className={`text-[0.87rem] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] border ${
            c.policy === 'blok' ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)] text-[var(--merah-teks)]' : 'bg-[var(--kuning-lembut)] border-[var(--kuning-garis)] text-[var(--kuning)]'
          }`}
        >
          <span className="font-medium">{CLASH_LABEL[c.type]}</span>
          {c.detail ? ` (${c.detail})` : ''} {c.type === 'mengajar' ? 'bersamaan dengan' : 'bentrok dengan'} <b>{c.label}</b> — {tanggalSingkat(c.tanggal)} {c.jam_mulai}–{c.jam_selesai}, tumpang tindih{' '}
          {c.overlapMinutes} menit.
        </li>
      ))}
    </ul>
  )
}

// A plain div, not <label>: some fields hold more than one control, and a <label> may wrap only one.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </div>
  )
}
