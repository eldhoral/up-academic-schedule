/**
 * Username logins: Supabase Auth needs an email, so a bare username signs in as <username>@penguji.local.
 * Used by accounts made on Pengguna with a username and by the external examiners' day accounts.
 */
const DOMAIN = 'penguji.local'

export const emailLogin = (input: string): string => (input.includes('@') ? input : `${input}@${DOMAIN}`)

/** What the person types to sign in: the username for a username login, else the email itself. */
export const namaLogin = (email: string): string => (email.endsWith(`@${DOMAIN}`) ? email.slice(0, -DOMAIN.length - 1) : email)

/** A new username: 3-30 of a-z 0-9 . _ -, starting with a letter or digit. eks- belongs to the external day accounts. */
export function cekUsername(raw: string): { username: string } | { error: string } {
  const username = raw.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    return { error: 'Username 3–30 karakter: huruf, angka, titik, garis bawah, atau tanda hubung, diawali huruf atau angka.' }
  }
  if (username.startsWith('eks-')) return { error: 'Username yang diawali "eks-" dipakai untuk akun penguji eksternal.' }
  return { username }
}
