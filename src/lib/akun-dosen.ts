/**
 * Login usernames for the dev account script (`npm run dev:akun-dosen`): the NIDN, or `dev-<kode>` when a
 * lecturer has none yet (never written back to Data Dosen). Lowercase, unique: a repeat gets -2, -3, ...
 */
export function usernameDosen(lecturers: { kode_dosen: string; nidn: string | null }[]): Map<string, string> {
  const dipakai = new Set<string>()
  const hasil = new Map<string, string>()
  for (const l of lecturers) {
    const nidn = (l.nidn ?? '').trim()
    const dasar = (nidn || `dev-${l.kode_dosen.toLowerCase().replace(/[^a-z0-9]/g, '')}`).toLowerCase()
    let u = dasar
    for (let i = 2; dipakai.has(u); i++) u = `${dasar}-${i}`
    dipakai.add(u)
    hasil.set(l.kode_dosen, u)
  }
  return hasil
}
