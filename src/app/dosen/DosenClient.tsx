'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportPanel } from '@/components/import/ImportPanel'
import { lecturerDisplayName } from '@/lib/import/tables'
import { createLecturerAction, deleteLecturerAction, updateLecturerAction, type FormState } from './actions'

export type Lecturer = {
  kode_dosen: string
  nidn: string
  nama: string
  gelar_depan: string
  gelar_belakang: string
}

export function DosenClient({ lecturers }: { lecturers: Lecturer[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Lecturer | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const filtered = lecturers.filter((l) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return l.kode_dosen.toLowerCase().includes(q) || l.nama.toLowerCase().includes(q) || l.nidn.includes(q)
  })

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Dosen</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {lecturers.length} lecturer{lecturers.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Add dosen
          </button>
        </div>

        <input
          type="search"
          placeholder="Search kode, nama, or NIDN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-[20rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mb-[1rem]"
        />

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Kode</Th>
                <Th>NIDN</Th>
                <Th>Nama tercetak</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.kode_dosen} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="mono">{l.kode_dosen}</Td>
                  <Td className="mono">{l.nidn || '—'}</Td>
                  <Td>{lecturerDisplayName(l)}</Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(l)}
                      className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                    >
                      Edit
                    </button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {lecturers.length === 0
                      ? 'No lecturers yet — add one, or import from Excel below.'
                      : <>No lecturers match &ldquo;{query}&rdquo;.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportPanel tableSlug="lecturers" label="Dosen" onCommitted={() => router.refresh()} />

      {editing && <LecturerFormModal lecturer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function LecturerFormModal({ lecturer, onClose }: { lecturer: Lecturer | null; onClose: () => void }) {
  const action = lecturer ? updateLecturerAction : createLecturerAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">
          {lecturer ? `Edit ${lecturer.kode_dosen}` : 'Add dosen'}
        </h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <Field label="Kode Dosen">
            <input
              name="kode_dosen"
              required
              defaultValue={lecturer?.kode_dosen}
              readOnly={!!lecturer}
              className={`w-full border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] ${
                lecturer ? 'bg-[var(--cekung)] text-[var(--tinta-3)]' : 'bg-[var(--cekung)]'
              }`}
            />
          </Field>
          <Field label="NIDN">
            <input
              name="nidn"
              defaultValue={lecturer?.nidn}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
            />
          </Field>
          <div className="flex gap-[0.8rem]">
            <Field label="Gelar depan" className="flex-1">
              <input
                name="gelar_depan"
                defaultValue={lecturer?.gelar_depan}
                placeholder="Dr."
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
              />
            </Field>
            <Field label="Nama" className="flex-[2]">
              <input
                name="nama"
                required
                defaultValue={lecturer?.nama}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
              />
            </Field>
          </div>
          <Field label="Gelar belakang">
            <input
              name="gelar_belakang"
              defaultValue={lecturer?.gelar_belakang}
              placeholder=", M.Si., Psikolog"
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {lecturer && <DeleteButton kodeDosen={lecturer.kode_dosen} onDone={onClose} />}
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

function DeleteButton({ kodeDosen, onDone }: { kodeDosen: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--merah)] cursor-pointer hover:bg-[var(--merah-lembut)]"
      >
        Delete
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await deleteLecturerAction(kodeDosen)
        router.refresh()
        onDone()
      }}
      className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--merah)] text-white text-[0.87rem] font-medium cursor-pointer"
    >
      Confirm delete?
    </button>
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
