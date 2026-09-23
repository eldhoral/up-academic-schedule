'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, ROLES, type Role } from '@/lib/roles'

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
  if (error) return { error: error.message }

  if (role !== 'VIEWER') {
    const { error: roleError } = await admin.from('profiles').update({ role }).eq('id', data.user.id)
    if (roleError) return { error: roleError.message }
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
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

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
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/pengguna')
  return { success: true }
}
