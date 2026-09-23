'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ROLES, ROLE_LABEL, type Role } from '@/lib/role-types'
import { createUserAction, deleteUserAction, updateUserRoleAction, type FormState } from './actions'

export type Profile = {
  id: string
  email: string
  role: Role
  created_at: string
}

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))

export function PenggunaClient({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Pengguna</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">{users.length} akun</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Tambah pengguna
          </button>
        </div>

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Email</Th>
                <Th>Peran</Th>
                <Th>Dibuat</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td>{u.email}</Td>
                  <Td>
                    {u.id === currentUserId ? (
                      <span className="text-[var(--tinta-3)]">{ROLE_LABEL[u.role]} (Anda)</span>
                    ) : (
                      <RoleSelect userId={u.id} role={u.role} />
                    )}
                  </Td>
                  <Td className="text-[var(--tinta-3)]">
                    {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Td>
                  <Td className="text-right">
                    {u.id !== currentUserId && (
                      <ConfirmDeleteButton
                        onConfirm={async () => {
                          await deleteUserAction(u.id)
                          router.refresh()
                        }}
                      />
                    )}
                  </Td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    Belum ada pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const router = useRouter()
  const [current, setCurrent] = useState(role)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleChange(next: string) {
    const formData = new FormData()
    formData.set('role', next)
    setCurrent(next as Role)
    setError('')
    startTransition(async () => {
      const result = await updateUserRoleAction(userId, null, formData)
      if (result && 'error' in result) {
        setError(result.error)
        setCurrent(role)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div>
      <Select
        value={current}
        onValueChange={handleChange}
        disabled={isPending}
        ariaLabel="Peran"
        options={ROLE_OPTIONS}
        className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.3rem] text-[0.87rem] min-h-[2.1rem]"
      />
      {error && <p className="mt-[0.2rem] text-[0.75rem] text-[var(--merah)]">{error}</p>}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(createUserAction, null)
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
        <h3 className="m-0 text-[1.1rem] font-semibold mb-[1rem]">Tambah pengguna</h3>

        {state && 'error' in state && (
          <div className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[1rem]">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-[0.8rem]">
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
          </Field>
          <Field label="Kata sandi awal">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
            />
            <p className="mt-[0.25rem] text-[0.8rem] text-[var(--tinta-3)]">Minimal 8 karakter. Bagikan ke pengguna secara langsung.</p>
          </Field>
          <Field label="Peran">
            <Select
              name="role"
              defaultValue="VIEWER"
              ariaLabel="Peran"
              options={ROLE_OPTIONS}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
            />
          </Field>

          <div className="flex gap-[0.6rem] justify-end pt-[0.4rem]">
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
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
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
