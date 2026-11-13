'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImportPanel } from '@/components/import/ImportPanel'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { PRODI_CONFIG } from '@/lib/prodi'
import { formatNilai, ipkSebelum } from '@/lib/penilaian/nilai'
import { useProdi } from '@/lib/use-prodi'
import { createStudentAction, deleteStudentAction, updateStudentAction, type FormState } from './actions'

export type Student = {
  id: string
  npm: string
  nama: string
  judul_skripsi: string
  email: string
  sks_sebelum: number | null
  bobot_sebelum: number | null
  tepat_waktu: boolean
}

const INPUT = 'w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]'

export function MahasiswaClient({ students, canEdit }: { students: Student[]; canEdit: boolean }) {
  const router = useRouter()
  const prodi = useProdi()
  const [editing, setEditing] = useState<Student | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? students.filter((s) => s.npm.includes(q) || s.nama.toLowerCase().includes(q) || s.judul_skripsi.toLowerCase().includes(q)) : students

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Mahasiswa</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">{students.length} mahasiswa · dipakai untuk {PRODI_CONFIG[prodi].defense.section.toLowerCase()}</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
            >
              Tambah mahasiswa
            </button>
          )}
        </div>

        <input
          type="search"
          placeholder="Cari NPM, nama, atau judul…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${INPUT} max-w-[20rem] mb-[1rem]`}
        />

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>NPM</Th>
                <Th>Nama</Th>
                <Th>{PRODI_CONFIG[prodi].defense.judul}</Th>
                <Th>Email</Th>
                <Th className="text-right">IPK</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td className="mono whitespace-nowrap">{s.npm}</Td>
                  <Td className="whitespace-nowrap">{s.nama}</Td>
                  <Td className="text-[var(--tinta-2)]">{s.judul_skripsi || '—'}</Td>
                  <Td className="text-[var(--tinta-2)]">{s.email || '—'}</Td>
                  <Td className="mono text-right whitespace-nowrap">{ipk(s)}</Td>
                  <Td className="text-right">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditing(s)}
                        className="text-[var(--biru)] hover:underline cursor-pointer bg-transparent border-0 p-0 text-[0.87rem]"
                      >
                        Ubah
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {students.length === 0
                      ? 'Belum ada data mahasiswa — tambahkan satu, atau impor dari Excel di bawah.'
                      : <>Tidak ada mahasiswa yang cocok dengan &ldquo;{query}&rdquo;.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && <ImportPanel tableSlug="students" label="Mahasiswa" prodi={prodi} onCommitted={() => router.refresh()} />}

      {editing && <StudentFormModal student={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** IPK before sidang, from the typed SKS and bobot: 2 decimals, or a dash when either is missing. */
const ipk = (s: Student) => {
  const v = ipkSebelum(s.bobot_sebelum, s.sks_sebelum)
  return v === null ? '—' : formatNilai(v)
}

function StudentFormModal({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const action = student ? updateStudentAction.bind(null, student.id) : createStudentAction
  const [state, formAction, isPending] = useActionState<FormState, FormData>(action, null)
  const router = useRouter()
  const prodi = useProdi()

  useEffect(() => {
    if (state && 'success' in state) {
      router.refresh()
      onClose()
    }
  }, [state, router, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[32rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">{student ? `Ubah ${student.npm}` : 'Tambah mahasiswa'}</h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <input type="hidden" name="prodi" value={prodi} />
          <Field label="NPM">
            <input name="npm" required inputMode="numeric" pattern="[0-9]+" defaultValue={student?.npm} className={`${INPUT} mono`} />
          </Field>
          <Field label="Nama">
            <input name="nama" required defaultValue={student?.nama} className={INPUT} />
          </Field>
          <Field label={PRODI_CONFIG[prodi].defense.judul}>
            <textarea name="judul_skripsi" rows={3} defaultValue={student?.judul_skripsi} className={`${INPUT} resize-y`} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={student?.email} className={INPUT} />
          </Field>
          <div className="flex gap-[0.8rem]">
            <Field label="SKS sebelum sidang" className="flex-1">
              <input name="sks_sebelum" inputMode="numeric" pattern="[0-9]*" defaultValue={student?.sks_sebelum ?? ''} className={`${INPUT} mono`} />
            </Field>
            <Field label="Bobot sebelum sidang" className="flex-1">
              <input name="bobot_sebelum" inputMode="decimal" defaultValue={student?.bobot_sebelum === null || student?.bobot_sebelum === undefined ? '' : formatNilai(student.bobot_sebelum)} className={`${INPUT} mono`} />
            </Field>
          </div>
          <label className="flex items-center gap-[0.4rem] text-[0.87rem]">
            <input type="checkbox" name="tepat_waktu" defaultChecked={student?.tepat_waktu} className="w-[1rem] h-[1rem]" />
            Lulus tepat waktu
          </label>

          <div className="flex gap-[0.6rem] justify-between pt-[0.4rem]">
            {student && (
              <ConfirmDeleteButton
                onConfirm={() => deleteStudentAction(prodi, student.id)}
                onDeleted={() => {
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
