'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, ROLES, type Role } from '@/lib/roles'
import { humanDbError } from '@/lib/db-error'

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

async function isLastSuperadmin(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (target?.role !== 'SUPERADMIN') return false

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'SUPERADMIN')
  return (count ?? 0) <= 1
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

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) return { error: humanDbError(error) }

  if (role !== 'VIEWER') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', data.user.id)
    if (roleError) return { error: humanDbError(roleError) }
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

  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
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
