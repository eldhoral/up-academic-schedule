'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportPanel } from '@/components/import/ImportPanel'
import { Select } from '@/components/Select'
import { createCourseAction, deleteCourseAction, updateCourseAction, type FormState } from './actions'

export type Course = {
  kode_mk: string
  nama_mk: string
  sks: number
  jenis_mk: 'A' | 'B'
  smt: number
  kurikulum: string
}

export function MataKuliahClient({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const filtered = courses.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.kode_mk.toLowerCase().includes(q) || c.nama_mk.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Mata Kuliah</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {courses.length} course{courses.length === 1 ? '' : 's'} &middot; kurikulum 2026
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Add mata kuliah
          </button>
        </div>

        <input
          type="search"
          placeholder="Search kode or nama…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-[20rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mb-[1rem]"
        />

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th className="text-right">SKS</Th>
                <Th>Jenis</Th>
                <Th className="text-right">Smt</Th>
                <Th>Kurikulum</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.kode_mk} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="mono">{c.kode_mk}</Td>
                  <Td>{c.nama_mk}</Td>
                  <Td className="text-right mono">{c.sks}</Td>
                  <Td>{c.jenis_mk === 'B' ? 'Pilihan' : 'Wajib'}</Td>
                  <Td className="text-right mono">{c.smt}</Td>
                  <Td>{c.kurikulum}</Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                    >
                      Edit
                    </button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {courses.length === 0
                      ? 'No courses yet — add one, or import from Excel below.'
                      : <>No courses match &ldquo;{query}&rdquo;.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportPanel tableSlug="courses" label="Mata Kuliah" onCommitted={() => router.refresh()} />

      {editing && (
        <CourseFormModal
          course={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CourseFormModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const action = course ? updateCourseAction : createCourseAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">
          {course ? `Edit ${course.kode_mk}` : 'Add mata kuliah'}
        </h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <Field label="Kode MK">
            <input
              name="kode_mk"
              required
              defaultValue={course?.kode_mk}
              readOnly={!!course}
              className={`w-full border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] ${
                course ? 'bg-[var(--cekung)] text-[var(--tinta-3)]' : 'bg-[var(--cekung)]'
              }`}
            />
          </Field>
          <Field label="Nama MK">
            <input
              name="nama_mk"
              required
              defaultValue={course?.nama_mk}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>
          <div className="flex gap-[0.8rem]">
            <Field label="SKS" className="flex-1">
              <input
                name="sks"
                type="number"
                min={1}
                required
                defaultValue={course?.sks}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
            </Field>
            <Field label="Semester" className="flex-1">
              <input
                name="smt"
                type="number"
                min={1}
                max={8}
                required
                defaultValue={course?.smt}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono"
              />
            </Field>
          </div>
          <div className="flex gap-[0.8rem]">
            <Field label="Jenis" className="flex-1">
              <Select
                name="jenis_mk"
                defaultValue={course?.jenis_mk ?? 'A'}
                ariaLabel="Jenis"
                options={[
                  { value: 'A', label: 'A — Wajib' },
                  { value: 'B', label: 'B — Pilihan' },
                ]}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
              />
            </Field>
            <Field label="Kurikulum" className="flex-1">
              <input
                name="kurikulum"
                defaultValue={course?.kurikulum ?? '2026'}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
              />
            </Field>
          </div>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {course && <DeleteButton kodeMk={course.kode_mk} onDone={onClose} />}
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

function DeleteButton({ kodeMk, onDone }: { kodeMk: string; onDone: () => void }) {
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
        await deleteCourseAction(kodeMk)
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
