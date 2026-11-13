'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, ROLES, type Role } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'
import { PRODI_ACCESS, type ProdiAccess } from '@/lib/prodi'
import { generatePassword } from '@/lib/password'

export type FormState = { error: string } | { success: true } | null

async function requireSuperadmin() {
  const me = await getCurrentUser()
  if (!me || me.role !== 'SUPERADMIN') {
    throw new Error('Hanya Super Admin yang dapat mengelola pengguna.')
  }
  return me
}

function readRole(formData: FormData): Role | null {
  const value = formData.get('role') as string
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null
}

function readProdiAccess(formData: FormData): ProdiAccess | null {
  const value = formData.get('prodi_access') as string
  return (PRODI_ACCESS as readonly string[]).includes(value) ? (value as ProdiAccess) : null
}

async function isLastSuperadmin(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (target?.role !== 'SUPERADMIN') return false

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SUPERADMIN')
  return (count ?? 0) <= 1
}

const DOSEN_TAKEN = 'Dosen ini sudah punya akun.'

type Admin = ReturnType<typeof createAdminClient>
type Access = { error: string } | { fields: { kode_dosen: string | null; prodi_access?: ProdiAccess } }

/**
 * Everything a role needs written in ONE profile update (the DB check ties role DOSEN to kode_dosen),
 * validated up front so a failure never leaves a half-made account. A DOSEN is S1 only and needs a
 * non-eksternal lecturer with no account yet; staff never keep a kode_dosen.
 */
async function resolveAccess(admin: Admin, role: Role, formData: FormData, userId?: string): Promise<Access> {
  if (role !== 'DOSEN') {
    const prodi_access = readProdiAccess(formData)
    return { fields: { kode_dosen: null, ...(prodi_access ? { prodi_access } : {}) } }
  }
  const kode = (formData.get('kode_dosen') as string | null)?.trim()
  if (!kode) return { error: 'Pilih dosen untuk akun Dosen.' }

  const { data: lecturer } = await admin.from('lecturers').select('eksternal').eq('kode_dosen', kode).maybeSingle()
  if (!lecturer) return { error: 'Pilih dosen untuk akun Dosen.' }
  if (lecturer.eksternal) return { error: 'Dosen eksternal tidak dapat diberi akun Dosen.' }

  let taken = admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'DOSEN').eq('kode_dosen', kode)
  if (userId) taken = taken.neq('id', userId)
  const { count } = await taken
  if (count) return { error: DOSEN_TAKEN }

  return { fields: { kode_dosen: kode, prodi_access: 's1' } }
}

// Only the DOSEN unique index can collide on a profile write (a race past the check above).
function profileError(error: { message: string; code?: string }, role: Role): string {
  return role === 'DOSEN' && error.code === '23505' ? DOSEN_TAKEN : humanDbError(error)
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSuperadmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const role = readRole(formData)

  if (!email) return { error: 'Email wajib diisi.' }
  if (!password || password.length < 8) return { error: 'Kata sandi minimal 8 karakter.' }
  if (!role) return { error: 'Peran tidak valid.' }
  if (role !== 'DOSEN' && !readProdiAccess(formData)) return { error: 'Akses prodi tidak valid.' }

  const admin = createAdminClient()
  const access = await resolveAccess(admin, role, formData)
  if ('error' in access) return access

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) return { error: humanDbError(error) }

  const { error: roleError } = await admin.from('profiles').update({ role, ...access.fields }).eq('id', data.user.id)
  if (roleError) {
    // No orphan login without a profile of the right role.
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: profileError(roleError, role) }
  }

  revalidatePath('/pengguna')
  return { success: true }
}

export async function updateUserRoleAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let me
  try {
    me = await requireSuperadmin()
  } catch (e) {
    return { error: (e as Error).message }
  }
  if (userId === me.id) return { error: 'Tidak dapat mengubah peran akun Anda sendiri.' }

  const role = readRole(formData)
  if (!role) return { error: 'Peran tidak valid.' }

  const admin = createAdminClient()
  if (role !== 'SUPERADMIN' && (await isLastSuperadmin(admin, userId))) {
    return { error: 'Tidak dapat mengubah peran ini — setidaknya harus ada satu Super Admin.' }
  }

  const access = await resolveAccess(admin, role, formData, userId)
  if ('error' in access) return access

  // The role form carries no prodi_access, so only a DOSEN (S1) changes it here.
  const { error } = await admin.from('profiles').update({ role, ...access.fields }).eq('id', userId)
  if (error) return { error: profileError(error, role) }

  revalidatePath('/pengguna')
  return { success: true }
}

export async function updateUserProdiAccessAction(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSuperadmin()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const prodi_access = readProdiAccess(formData)
  if (!prodi_access) return { error: 'Akses prodi tidak valid.' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ prodi_access }).eq('id', userId)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/pengguna')
  return { success: true }
}

export async function deleteUserAction(userId: string): Promise<FormState> {
  let me
  try {
    me = await requireSuperadmin()
  } catch (e) {
    return { error: (e as Error).message }
  }
  if (userId === me.id) return { error: 'Tidak dapat menghapus akun Anda sendiri.' }

  const admin = createAdminClient()
  if (await isLastSuperadmin(admin, userId)) {
    return { error: 'Tidak dapat menghapus akun ini — setidaknya harus ada satu Super Admin.' }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/pengguna')
  return { success: true }
}

export async function resetPasswordAction(userId: string): Promise<{ error: string } | { password: string }> {
  let me
  try {
    me = await requireSuperadmin()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const password = generatePassword()
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: humanDbError(error) }

  // Like the auth events in src/app/actions/auth.ts: an UPDATE on "auth", best-effort. Never the password.
  const { error: logError } = await admin.from('audit_log').insert({
    actor_id: me.id,
    actor_email: me.email,
    action: 'UPDATE',
    table_name: 'auth',
    record_id: userId,
    new_data: { email: data.user?.email ?? null, kata_sandi: 'diatur ulang' },
  })
  if (logError) console.error('audit_log reset password insert failed:', logError.message)

  return { password }
}
