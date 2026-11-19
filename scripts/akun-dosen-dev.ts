/**
 * DEV ONLY. Replaces every DOSEN account with a fresh one per non-eksternal lecturer in Data Dosen.
 *
 *   npm run dev:akun-dosen -- --yakin
 *
 * - Deletes all auth users whose profile role is DOSEN (their grades stay; submitted_by becomes null).
 * - Creates one account per lecturer with eksternal = false: username = NIDN, or dev-<kode> when the NIDN is
 *   empty (not written to Data Dosen). The login form takes the bare username (emailLogin adds the domain).
 * - One shared password for every dosen (dev convenience): DEV_PASSWORD_DOSEN from .env.local, or a random one
 *   made for this run. It is printed once and written with the usernames to docs/akun-dosen-dev.csv (docs/ is
 *   gitignored). Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Not a migration on purpose: migrations run in every environment, and this wipes logins.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createAdminClient } from '../src/lib/supabase/admin'
import { generatePassword } from '../src/lib/password'
import { emailLogin } from '../src/lib/penilaian/akun-eksternal'
import { lecturerDisplayName } from '../src/lib/import/tables'
import { usernameDosen } from '../src/lib/akun-dosen'

const OUT = 'docs/akun-dosen-dev.csv'
const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

async function main() {
  if (!process.argv.includes('--yakin')) {
    console.error('Skrip ini MENGHAPUS semua akun Dosen lalu membuat ulang. Khusus dev. Jalankan dengan --yakin.')
    process.exit(1)
  }
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://x').host
  console.log(`Supabase: ${host}`)
  const db = createAdminClient()

  // 1. Delete every DOSEN login (the profile row goes with the auth user).
  const { data: lama, error: e1 } = await db.from('profiles').select('id').eq('role', 'DOSEN')
  if (e1) throw new Error(`Gagal membaca akun dosen: ${e1.message}`)
  for (const p of lama ?? []) {
    const { error } = await db.auth.admin.deleteUser(p.id as string)
    if (error) throw new Error(`Gagal menghapus akun ${p.id}: ${error.message}`)
  }
  console.log(`Dihapus: ${lama?.length ?? 0} akun dosen`)

  // 2. One account per internal lecturer.
  const { data: dosen, error: e2 } = await db
    .from('lecturers').select('kode_dosen, nidn, nama, gelar_depan, gelar_belakang').eq('eksternal', false).order('kode_dosen')
  if (e2) throw new Error(`Gagal membaca data dosen: ${e2.message}`)
  const username = usernameDosen(dosen ?? [])
  // ponytail: one shared password is fine on a dev project only; never point this script at production.
  const password = process.env.DEV_PASSWORD_DOSEN || generatePassword()
  if (password.length < 8) throw new Error('DEV_PASSWORD_DOSEN minimal 8 karakter.')

  const baris = ['kode_dosen,nama,username,password']
  const gagal: string[] = []
  for (const l of dosen ?? []) {
    const u = username.get(l.kode_dosen)!
    const { data, error } = await db.auth.admin.createUser({ email: emailLogin(u), password, email_confirm: true })
    if (error || !data.user) {
      gagal.push(`${l.kode_dosen}: ${error?.message ?? 'tidak ada user'}`)
      continue
    }
    // One update sets role and kode together (the DB check ties DOSEN to kode_dosen).
    const { error: e3 } = await db.from('profiles').update({ role: 'DOSEN', kode_dosen: l.kode_dosen, prodi_access: 's1' }).eq('id', data.user.id)
    if (e3) {
      await db.auth.admin.deleteUser(data.user.id) // no login without its profile
      gagal.push(`${l.kode_dosen}: ${e3.message}`)
      continue
    }
    baris.push([l.kode_dosen, lecturerDisplayName(l), u, password].map(csv).join(','))
  }

  mkdirSync('docs', { recursive: true })
  writeFileSync(OUT, `${baris.join('\n')}\n`, { mode: 0o600 })
  console.log(`Dibuat: ${baris.length - 1} akun dosen → ${OUT}`)
  console.log(`Kata sandi semua dosen: ${password}${process.env.DEV_PASSWORD_DOSEN ? ' (dari DEV_PASSWORD_DOSEN)' : ' (acak; simpan sebagai DEV_PASSWORD_DOSEN di .env.local agar tetap sama)'}`)
  if (gagal.length) {
    console.log(`Gagal: ${gagal.length}`)
    for (const g of gagal) console.log(`  ${g}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
