'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { GeneratedSlot } from '@/lib/sesi-generator'
import { HARI_DB as HARI, hariLabel } from '@/lib/hari'
import {
  commitGeneratedSessions,
  deleteSessionAction,
  previewGeneratedSessions,
  updateSessionAction,
  type FormState,
} from './actions'

export type SessionRow = {
  id: string
  hari: string
  sesi_ke: number
  jam_mulai: string
  jam_selesai: string
  sks: number
  active: boolean
}

export function SesiClient({
  sessions,
  jamMulaiReguler,
  jamMulaiRegsus,
  jedaMenit,
}: {
  sessions: SessionRow[]
  jamMulaiReguler: string
  jamMulaiRegsus: string
  jedaMenit: number
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<SessionRow | null>(null)

  const byHari = HARI.map((h) => ({ hari: h, rows: sessions.filter((s) => s.hari === h) })).filter(
    (g) => g.rows.length > 0
  )

  return (
    <div className="space-y-[1.2rem]">
      <GeneratorPanel
        jamMulaiReguler={jamMulaiReguler}
        jamMulaiRegsus={jamMulaiRegsus}
        jedaMenit={jedaMenit}
        onSaved={() => router.refresh()}
      />

      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem]">
          <div>
            <h2 className="text-[1.07rem] font-semibold">Sesi tersimpan</h2>
            <p className="text-[0.87rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {sessions.length} session{sessions.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {byHari.length === 0 && <p className="text-[0.93rem] text-[var(--tinta-3)] py-[1rem]">No sessions yet — generate a day above.</p>}

        <div className="space-y-[1.2rem]">
          {byHari.map(({ hari, rows }) => (
            <div key={hari}>
              <h3 className="text-[0.87rem] font-semibold text-[var(--tinta-2)] mb-[0.4rem]">{hariLabel(hari)}</h3>
              <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
                <table className="w-full text-[0.87rem] border-collapse">
                  <thead className="bg-[var(--cekung)]">
                    <tr>
                      <Th>Sesi</Th>
                      <Th>Jam</Th>
                      <Th className="text-right">SKS</Th>
                      <Th>Status</Th>
                      <Th className="text-right">&nbsp;</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .sort((a, b) => a.sesi_ke - b.sesi_ke)
                      .map((s) => (
                        <tr key={s.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                          <Td className="mono">{s.sesi_ke}</Td>
                          <Td className="mono">
                            {s.jam_mulai.slice(0, 5)}–{s.jam_selesai.slice(0, 5)}
                          </Td>
                          <Td className="text-right mono">{s.sks}</Td>
                          <Td>
                            <span
                              className={`inline-block px-[0.4rem] py-[0.1rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium ${
                                s.active ? 'bg-[var(--hijau-lembut)] text-[var(--hijau)]' : 'bg-[var(--cekung)] text-[var(--tinta-3)]'
                              }`}
                            >
                              {s.active ? 'Active' : 'Inactive'}
                            </span>
                          </Td>
                          <Td className="text-right">
                            <button
                              type="button"
                              onClick={() => setEditing(s)}
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
            </div>
          ))}
        </div>
      </div>

      {editing && <SessionFormModal session={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function GeneratorPanel({
  jamMulaiReguler,
  jamMulaiRegsus,
  jedaMenit,
  onSaved,
}: {
  jamMulaiReguler: string
  jamMulaiRegsus: string
  jedaMenit: number
  onSaved: () => void
}) {
  const [hari, setHari] = useState('SENIN')
  const [startJam, setStartJam] = useState(jamMulaiReguler.slice(0, 5))
  const [pattern, setPattern] = useState('2,2,3,2,2')
  const [jeda, setJeda] = useState(jedaMenit)
  const [replaceDay, setReplaceDay] = useState(false)
  const [preview, setPreview] = useState<GeneratedSlot[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPreviewing, startPreview] = useTransition()
  const [isSaving, startSaving] = useTransition()

  function handlePreview() {
    setError(null)
    setMessage(null)
    startPreview(async () => {
      const result = await previewGeneratedSessions({ hari, startJam, pattern, jedaMenit: jeda, replaceDay })
      if (result.ok) setPreview(result.preview)
      else {
        setError(result.error)
        setPreview(null)
      }
    })
  }

  function handleSave() {
    if (!preview) return
    startSaving(async () => {
      const result = await commitGeneratedSessions(hari, replaceDay, preview)
      if (result.ok) {
        setMessage(`${preview.length} session${preview.length === 1 ? '' : 's'} saved for ${hariLabel(hari)}.`)
        setPreview(null)
        onSaved()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
      <h1 className="text-[1.3rem] font-semibold">Sesi Perkuliahan</h1>
      <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem] mb-[1.2rem]">
        Generate a day of back-to-back sessions from a start time and an SKS pattern. Jeda and midday break come from
        Pengaturan; rows stay editable afterwards.
      </p>

      <div className="flex flex-wrap gap-[0.8rem] items-end">
        <Field label="Hari">
          <select
            value={hari}
            onChange={(e) => setHari(e.target.value)}
            className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
          >
            {HARI.map((h) => (
              <option key={h} value={h}>
                {hariLabel(h)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Jam mulai">
          <div className="flex gap-[0.4rem] items-center">
            <input
              type="time"
              value={startJam}
              onChange={(e) => setStartJam(e.target.value)}
              className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem] mono"
            />
            <button
              type="button"
              onClick={() => setStartJam(jamMulaiReguler.slice(0, 5))}
              className="text-[0.8rem] text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 whitespace-nowrap"
            >
              Reguler
            </button>
            <button
              type="button"
              onClick={() => setStartJam(jamMulaiRegsus.slice(0, 5))}
              className="text-[0.8rem] text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 whitespace-nowrap"
            >
              Regsus
            </button>
          </div>
        </Field>

        <Field label="SKS pattern" className="flex-1 min-w-[14rem]">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="2,2,3,2,2"
            className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
          />
        </Field>

        <Field label="Jeda (menit)">
          <input
            type="number"
            min={0}
            value={jeda}
            onChange={(e) => setJeda(parseInt(e.target.value, 10) || 0)}
            className="w-[5rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
          />
        </Field>

        <label className="flex items-center gap-[0.4rem] text-[0.87rem] pb-[0.5rem]">
          <input type="checkbox" checked={replaceDay} onChange={(e) => setReplaceDay(e.target.checked)} className="w-[1rem] h-[1rem]" />
          Ganti sesi {hariLabel(hari)} yang ada
        </label>

        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--cekung)] disabled:opacity-60"
        >
          {isPreviewing ? 'Menghitung…' : 'Preview'}
        </button>
      </div>

      {error && <p className="mt-[0.8rem] text-[0.87rem] text-[var(--merah)]">{error}</p>}
      {message && <p className="mt-[0.8rem] text-[0.87rem] text-[var(--hijau)]">{message}</p>}

      {preview && (
        <div className="mt-[1rem]">
          <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)] max-h-[16rem] overflow-y-auto">
            <table className="w-full text-[0.87rem] border-collapse">
              <thead className="sticky top-0 bg-[var(--cekung)]">
                <tr>
                  <Th>Sesi</Th>
                  <Th>Jam</Th>
                  <Th className="text-right">SKS</Th>
                </tr>
              </thead>
              <tbody>
                {preview.map((s) => (
                  <tr key={s.sesi_ke} className="border-t border-[var(--garis)]">
                    <Td className="mono">{s.sesi_ke}</Td>
                    <Td className="mono">
                      {s.jam_mulai}–{s.jam_selesai}
                    </Td>
                    <Td className="text-right mono">{s.sks}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="mt-[0.8rem] px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan…' : `Simpan ${preview.length} sesi`}
          </button>
        </div>
      )}
    </div>
  )
}

function SessionFormModal({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const boundAction = updateSessionAction.bind(null, session.id)
  const [state, formAction, isPending] = useActionState<FormState, FormData>(boundAction, null)
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[24rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">
          Edit {hariLabel(session.hari)} · sesi {session.sesi_ke}
        </h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <input type="hidden" name="hari" value={session.hari} />
          <Field label="Sesi ke">
            <input
              name="sesi_ke"
              type="number"
              min={1}
              required
              defaultValue={session.sesi_ke}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
            />
          </Field>
          <div className="flex gap-[0.8rem]">
            <Field label="Jam mulai" className="flex-1">
              <input
                name="jam_mulai"
                type="time"
                required
                defaultValue={session.jam_mulai.slice(0, 5)}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
            </Field>
            <Field label="Jam selesai" className="flex-1">
              <input
                name="jam_selesai"
                type="time"
                required
                defaultValue={session.jam_selesai.slice(0, 5)}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
            </Field>
          </div>
          <Field label="SKS">
            <input
              name="sks"
              type="number"
              min={1}
              required
              defaultValue={session.sks}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
            />
          </Field>
          <label className="flex items-center gap-[0.5rem] text-[0.93rem]">
            <input type="checkbox" name="active" defaultChecked={session.active} className="w-[1rem] h-[1rem]" />
            Active
          </label>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await deleteSessionAction(session.id)
                  router.refresh()
                  onClose()
                }}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer"
              >
                Confirm delete?
              </button>
            )}
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

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </label>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)] ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[0.6rem] py-[0.4rem] ${className}`}>{children}</td>
}
