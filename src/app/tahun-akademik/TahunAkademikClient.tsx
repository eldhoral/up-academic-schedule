'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import {
  createAcademicYearAction,
  deleteAcademicYearAction,
  updateAcademicYearAction,
  type FormState,
} from './actions'

export type AcademicYearRow = {
  id: string
  label: string
  is_active: boolean
}

export function TahunAkademikClient({ years }: { years: AcademicYearRow[] }) {
  const [editing, setEditing] = useState<AcademicYearRow | 'new' | null>(null)

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Tahun Akademik</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {years.length} tahun akademik
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Tambah Tahun Akademik
          </button>
        </div>

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>ID</Th>
                <Th>Label</Th>
                <Th>Status</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="mono">{y.id}</Td>
                  <Td>{y.label}</Td>
                  <Td>
                    <span
                      className={`inline-block px-[0.4rem] py-[0.1rem] rounded-[var(--r-kecil)] text-[0.8rem] font-medium ${
                        y.is_active ? 'bg-[var(--hijau-lembut)] text-[var(--hijau)]' : 'bg-[var(--cekung)] text-[var(--tinta-3)]'
                      }`}
                    >
                      {y.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(y)}
                      className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                    >
                      Ubah
                    </button>
                  </Td>
                </tr>
              ))}
              {years.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    Belum ada tahun akademik — tambahkan yang pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <AcademicYearFormModal year={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function AcademicYearFormModal({ year, onClose }: { year: AcademicYearRow | null; onClose: () => void }) {
  const action = year ? updateAcademicYearAction.bind(null, year.id) : createAcademicYearAction
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
          {year ? `Ubah ${year.label}` : 'Tambah Tahun Akademik'}
        </h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <Field label="ID">
            <input
              name="id"
              required
              defaultValue={year?.id}
              readOnly={!!year}
              placeholder="20271"
              className={`w-full border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] mono ${
                year ? 'bg-[var(--cekung)] text-[var(--tinta-3)]' : 'bg-[var(--cekung)]'
              }`}
            />
            <p className="mt-[0.2rem] text-[0.8rem] text-[var(--tinta-3)]">
              Kode unik singkat, misalnya &ldquo;20271&rdquo; untuk 2027/2028 Gasal. Tidak dapat diubah setelah
              dibuat.
            </p>
          </Field>
          <Field label="Label">
            <input
              name="label"
              required
              defaultValue={year?.label}
              placeholder="2027/2028 Gasal"
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>
          <label className="flex items-center gap-[0.5rem] text-[0.93rem]">
            <input type="checkbox" name="is_active" defaultChecked={year?.is_active ?? false} className="w-[1rem] h-[1rem]" />
            Aktif
          </label>
          <p className="text-[0.8rem] text-[var(--tinta-3)]">
            Hanya satu tahun akademik yang dapat aktif. Mencentang ini akan menonaktifkan tahun akademik lain yang aktif.
          </p>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {year && (
              <ConfirmDeleteButton
                onConfirm={async () => {
                  await deleteAcademicYearAction(year.id)
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-[0.8rem] font-medium text-[var(--tinta-2)] mb-[0.25rem]">{label}</span>
      {children}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-[0.6rem] py-[0.4rem] font-medium text-[var(--tinta-3)] ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-[0.6rem] py-[0.4rem] ${className}`}>{children}</td>
}
