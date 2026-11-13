'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select, type SelectOption } from '@/components/Select'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ROLES, ROLE_LABEL, type Role } from '@/lib/role-types'
import { PRODI_ACCESS, PRODI_ACCESS_LABEL, type ProdiAccess } from '@/lib/prodi'
import { createUserAction, deleteUserAction, resetPasswordAction, updateUserProdiAccessAction, updateUserRoleAction, type FormState } from './actions'

export type Profile = {
  id: string
  email: string
  role: Role
  prodi_access: ProdiAccess
  kode_dosen: string | null
  created_at: string
}

/** Every lecturer; only the non-eksternal ones without an account can be picked. */
export type DosenOption = { kode_dosen: string; nama: string; eksternal: boolean }

// EKSTERNAL accounts are made from Akun Penguji Eksternal, so the pickers never offer the role.
const PICKABLE_ROLES = ROLES.filter((r) => r !== 'EKSTERNAL')
const ROLE_OPTIONS = PICKABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))
const PRODI_ACCESS_OPTIONS = PRODI_ACCESS.map((a) => ({ value: a, label: PRODI_ACCESS_LABEL[a] }))

export function PenggunaClient({ users, currentUserId, dosen }: { users: Profile[]; currentUserId: string; dosen: DosenOption[] }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'semua' | Role>('semua')

  const dosenName = new Map(dosen.map((d) => [d.kode_dosen, d.nama]))
  const taken = new Set(users.map((u) => u.kode_dosen))
  const pickable = dosen
    .filter((d) => !d.eksternal && !taken.has(d.kode_dosen))
    .map((d) => ({ value: d.kode_dosen, label: `${d.nama} (${d.kode_dosen})` }))

  const filtered = users.filter((u) => {
    if (roleFilter !== 'semua' && u.role !== roleFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return u.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-[1.2rem]">
      <div className="bg-[var(--lembar)] border border-[var(--garis)] rounded-[var(--r-sedang)] p-[1.6rem]">
        <div className="flex items-center justify-between pb-[1rem] border-b border-[var(--garis)] mb-[1.2rem] gap-[1rem] flex-wrap">
          <div>
            <h1 className="text-[1.3rem] font-semibold">Pengguna</h1>
            <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
              {roleFilter === 'semua' ? `${filtered.length} dari ${users.length} akun` : `${filtered.length} akun · ${ROLE_LABEL[roleFilter]}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-[0.8rem] py-[0.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.98] transition-colors"
          >
            Tambah pengguna
          </button>
        </div>

        <div className="flex items-center gap-[0.53rem] flex-wrap mb-[1rem]">
          <input
            type="search"
            placeholder="Cari email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full max-w-[20rem] bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem]"
          />
          <div className="flex items-center gap-[0.4rem] flex-wrap">
            <FilterChip active={roleFilter === 'semua'} onClick={() => setRoleFilter('semua')}>
              Semua peran
            </FilterChip>
            {PICKABLE_ROLES.map((r) => (
              <FilterChip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>
                {ROLE_LABEL[r]}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-[var(--garis)] rounded-[var(--r-kecil)]">
          <table className="w-full text-[0.87rem] border-collapse">
            <thead className="bg-[var(--cekung)]">
              <tr>
                <Th>Email</Th>
                <Th>Peran</Th>
                <Th>Akses Prodi</Th>
                <Th>Dibuat</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-[var(--garis)] h-[2.4rem]">
                  <Td>{u.email}</Td>
                  <Td>
                    {u.id === currentUserId || u.role === 'EKSTERNAL' ? (
                      <span className="text-[var(--tinta-3)]">{ROLE_LABEL[u.role]}{u.id === currentUserId ? ' (Anda)' : ''}</span>
                    ) : (
                      <RoleSelect userId={u.id} role={u.role} dosenOptions={pickable} />
                    )}
                    {u.role === 'DOSEN' && u.kode_dosen && (
                      <p className="mt-[0.2rem] text-[0.75rem] text-[var(--tinta-3)]">
                        {ROLE_LABEL.DOSEN} · {dosenName.get(u.kode_dosen) ?? u.kode_dosen}
                      </p>
                    )}
                  </Td>
                  <Td>
                    {u.role === 'SUPERADMIN' || u.role === 'DOSEN' || u.role === 'EKSTERNAL' ? (
                      <span className="text-[var(--tinta-3)]">{u.role === 'SUPERADMIN' ? 'Semua' : 'S1'}</span>
                    ) : (
                      <ProdiAccessSelect userId={u.id} access={u.prodi_access} />
                    )}
                  </Td>
                  <Td className="text-[var(--tinta-3)]">
                    {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex items-start gap-[0.3rem]">
                      <button
                        type="button"
                        onClick={() => setResetting(u)}
                        className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] text-[0.87rem] text-[var(--tinta-2)] cursor-pointer hover:bg-[var(--cekung)]"
                      >
                        Atur ulang kata sandi
                      </button>
                      {u.id !== currentUserId && (
                        <ConfirmDeleteButton
                          onConfirm={() => deleteUserAction(u.id)}
                          onDeleted={() => {
                            router.refresh()
                          }}
                        />
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-[1.6rem] text-[var(--tinta-3)]">
                    {users.length === 0 ? 'Belum ada pengguna.' : <>Tidak ada pengguna yang cocok dengan &ldquo;{query}&rdquo;.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal dosenOptions={pickable} onClose={() => setShowCreate(false)} />}
      {resetting && <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}

function RoleSelect({ userId, role, dosenOptions }: { userId: string; role: Role; dosenOptions: SelectOption[] }) {
  const router = useRouter()
  const [current, setCurrent] = useState(role)
  const [kodeDosen, setKodeDosen] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Picking Dosen only arms the picker; nothing is saved until a dosen is chosen.
  const choosingDosen = current === 'DOSEN' && role !== 'DOSEN'

  function save(next: Role) {
    const formData = new FormData()
    formData.set('role', next)
    if (next === 'DOSEN') formData.set('kode_dosen', kodeDosen)
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

  function handleChange(next: string) {
    setCurrent(next as Role)
    setError('')
    if (next !== 'DOSEN') save(next as Role)
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
      {choosingDosen && (
        <div className="mt-[0.3rem] flex items-center gap-[0.3rem]">
          <Select
            value={kodeDosen}
            onValueChange={setKodeDosen}
            disabled={isPending}
            ariaLabel="Dosen"
            placeholder="Pilih dosen"
            options={dosenOptions}
            className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.3rem] text-[0.87rem] min-h-[2.1rem]"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => save('DOSEN')}
            className="px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.8rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
          >
            Simpan
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setCurrent(role)}
            className="px-[0.6rem] py-[0.3rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.8rem] cursor-pointer hover:bg-[var(--cekung)]"
          >
            Batal
          </button>
        </div>
      )}
      {error && <p className="mt-[0.2rem] text-[0.75rem] text-[var(--merah)]">{error}</p>}
    </div>
  )
}

function ProdiAccessSelect({ userId, access }: { userId: string; access: ProdiAccess }) {
  const router = useRouter()
  const [current, setCurrent] = useState(access)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleChange(next: string) {
    const formData = new FormData()
    formData.set('prodi_access', next)
    setCurrent(next as ProdiAccess)
    setError('')
    startTransition(async () => {
      const result = await updateUserProdiAccessAction(userId, null, formData)
      if (result && 'error' in result) {
        setError(result.error)
        setCurrent(access)
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
        ariaLabel="Akses Prodi"
        options={PRODI_ACCESS_OPTIONS}
        className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.3rem] text-[0.87rem] min-h-[2.1rem]"
      />
      {error && <p className="mt-[0.2rem] text-[0.75rem] text-[var(--merah)]">{error}</p>}
    </div>
  )
}

function CreateUserModal({ dosenOptions, onClose }: { dosenOptions: SelectOption[]; onClose: () => void }) {
  const [role, setRole] = useState<Role>('VIEWER')
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
              value={role}
              onValueChange={(v) => setRole(v as Role)}
              ariaLabel="Peran"
              options={ROLE_OPTIONS}
              className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
            />
          </Field>
          {role === 'DOSEN' ? (
            <Field label="Dosen">
              <Select
                name="kode_dosen"
                ariaLabel="Dosen"
                placeholder="Pilih dosen"
                options={dosenOptions}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
              />
              <p className="mt-[0.25rem] text-[0.8rem] text-[var(--tinta-3)]">Hanya dosen non-eksternal yang belum punya akun. Akses prodi: S1.</p>
            </Field>
          ) : (
            <Field label="Akses Prodi">
              <Select
                name="prodi_access"
                defaultValue="s1"
                ariaLabel="Akses Prodi"
                options={PRODI_ACCESS_OPTIONS}
                className="w-full bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[0.93rem] min-h-[2.4rem]"
              />
            </Field>
          )}

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

function ResetPasswordModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [password, setPassword] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setError('')
    startTransition(async () => {
      const result = await resetPasswordAction(user.id)
      if ('error' in result) setError(result.error)
      else setPassword(result.password)
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password ?? '')
      setCopied(true)
    } catch {
      setError('Tidak dapat menyalin. Salin kata sandi secara manual.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reset-judul">
      <div className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] p-[1.4rem]">
        <h3 id="reset-judul" className="m-0 text-[1.1rem] font-semibold mb-[0.6rem]">Atur ulang kata sandi</h3>

        {error && (
          <div role="alert" className="bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.87rem] text-[var(--merah)] mb-[0.8rem]">
            {error}
          </div>
        )}

        {password === null ? (
          <p className="text-[0.93rem] text-[var(--tinta-2)] mb-[1rem]">
            Buat kata sandi baru untuk <strong>{user.email}</strong>? Kata sandi lama langsung tidak berlaku.
          </p>
        ) : (
          <>
            <p className="text-[0.93rem] text-[var(--tinta-2)] mb-[0.6rem]">Kata sandi baru untuk <strong>{user.email}</strong>:</p>
            <div className="flex items-center gap-[0.5rem] mb-[0.6rem]">
              <code className="flex-1 bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.6rem] py-[0.4rem] text-[1rem] tracking-[0.05em] select-all">
                {password}
              </code>
              <button
                type="button"
                onClick={copy}
                className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
              >
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p className="text-[0.8rem] text-[var(--tinta-3)] mb-[1rem]">Kata sandi ini tidak akan ditampilkan lagi. Bagikan ke pengguna secara langsung.</p>
          </>
        )}

        <div className="flex gap-[0.6rem] justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-[0.7rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
          >
            {password === null ? 'Batal' : 'Tutup'}
          </button>
          {password === null && (
            <button
              type="button"
              disabled={isPending}
              onClick={reset}
              className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white text-[0.87rem] font-medium cursor-pointer hover:bg-[var(--biru-hover)] disabled:opacity-60"
            >
              {isPending ? 'Membuat…' : 'Buat kata sandi baru'}
            </button>
          )}
        </div>
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
