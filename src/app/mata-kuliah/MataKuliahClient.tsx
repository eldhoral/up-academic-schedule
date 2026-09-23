'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportPanel } from '@/components/import/ImportPanel'
import { Select } from '@/components/Select'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
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
  const [kurikulumFilter, setKurikulumFilter] = useState('semua')

  const kurikulumList = Array.from(new Set(courses.map((c) => c.kurikulum))).sort((a, b) => b.localeCompare(a))

  const filtered = courses.filter((c) => {
    if (kurikulumFilter !== 'semua' && c.kurikulum !== kurikulumFilter) return false
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
              {filtered.length} dari {courses.length} mata kuliah &middot; {kurikulumList.length} kurikulum
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Tambah mata kuliah
          </button>
        </div>

        <div className="flex items-center gap-[0.53rem] flex-wrap mb-[1rem]">
          <input
            type="search"
            placeholder="Cari kode atau nama…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-[20rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
          />
          <div className="flex items-center gap-[0.4rem] flex-wrap">
            <FilterChip active={kurikulumFilter === 'semua'} onClick={() => setKurikulumFilter('semua')}>
              Semua kurikulum
            </FilterChip>
            {kurikulumList.map((k) => (
              <FilterChip key={k} active={kurikulumFilter === k} onClick={() => setKurikulumFilter(k)}>
                {k}
              </FilterChip>
            ))}
          </div>
        </div>

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
                      Ubah
                    </button>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {courses.length === 0
                      ? 'Belum ada mata kuliah — tambahkan satu, atau impor dari Excel di bawah.'
                      : <>Tidak ada mata kuliah yang cocok dengan &ldquo;{query}&rdquo;.</>}
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
          kurikulumList={kurikulumList}
          defaultKurikulum={kurikulumFilter !== 'semua' ? kurikulumFilter : kurikulumList[0] ?? ''}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium border transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--biru-lembut)] text-[var(--biru)] border-[var(--biru)]/30'
          : 'bg-[var(--lembar)] text-[var(--tinta-3)] border-[var(--garis-kuat)] hover:bg-[var(--cekung)]'
      }`}
    >
      {children}
    </button>
  )
}

function CourseFormModal({
  course,
  kurikulumList,
  defaultKurikulum,
  onClose,
}: {
  course: Course | null
  kurikulumList: string[]
  defaultKurikulum: string
  onClose: () => void
}) {
  const action = course ? updateCourseAction : createCourseAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()

  const NEW_KURIKULUM = '__baru__'
  const initialKurikulum = course?.kurikulum ?? defaultKurikulum
  const [kurikulumMode, setKurikulumMode] = useState<'pilih' | 'baru'>(
    initialKurikulum && !kurikulumList.includes(initialKurikulum) ? 'baru' : 'pilih'
  )
  const [kurikulum, setKurikulum] = useState(initialKurikulum)

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
          {course ? `Ubah ${course.kode_mk}` : 'Tambah mata kuliah'}
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
          </div>

          <Field label="Kurikulum">
            {kurikulumMode === 'pilih' && kurikulumList.length > 0 ? (
              <Select
                value={kurikulum}
                onValueChange={(v) => {
                  if (v === NEW_KURIKULUM) {
                    setKurikulumMode('baru')
                    setKurikulum('')
                  } else {
                    setKurikulum(v)
                  }
                }}
                ariaLabel="Kurikulum"
                options={[...kurikulumList.map((k) => ({ value: k, label: k })), { value: NEW_KURIKULUM, label: '+ Kurikulum baru…' }]}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
              />
            ) : (
              <div className="flex gap-[0.5rem]">
                <input
                  value={kurikulum}
                  onChange={(e) => setKurikulum(e.target.value)}
                  placeholder="mis. 2029"
                  required
                  className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
                />
                {kurikulumList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setKurikulumMode('pilih')
                      setKurikulum(kurikulumList[0])
                    }}
                    className="shrink-0 text-[0.8rem] text-[var(--tinta-3)] hover:underline cursor-pointer bg-transparent border-0 px-[0.4rem]"
                  >
                    Batal
                  </button>
                )}
              </div>
            )}
            <input type="hidden" name="kurikulum" value={kurikulum} />
          </Field>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {course && (
              <ConfirmDeleteButton
                onConfirm={async () => {
                  await deleteCourseAction(course.kode_mk)
                  router.refresh()
                  onClose()
                }}
              />
            )}
            <div className="flex gap-[0.6rem] ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
              >
                {isPending ? 'Menyimpan…' : 'Simpan'}
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
