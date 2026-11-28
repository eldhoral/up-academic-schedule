'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManage, getCurrentRole } from '@/lib/roles'
import { ensureAkunEksternal } from '@/lib/penilaian/akun-eksternal'
import { bisaDinilaiSidang } from '@/lib/penilaian/akses'
import type { StatusPrasidang } from '@/lib/penilaian/prasidang'
import { humanDbError } from '@/lib/db-error'
import { orientFinding } from '@/lib/clash'
import { parseProdi, prodiTag, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'
import { findDefenseClashes, findTeachingOverlaps, type DefenseClashInput, type DefenseClashType } from './defense-clash'
import { normalizeDefenseLink } from './defense-types'
import { loadDefenseWorld } from './defense-query'
import { jenisLabel, type DefenseJenis } from './defense-types'
import type { ClashPolicy } from '../kuliah/clash-actions'

export type DefenseInput = {
  id: string | null // null = new
  academic_year_id: string
  prodi: Prodi
  jenis: DefenseJenis
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  room_id: string | null
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  pembimbing_kode: string | null
  penguji_kode: string | null
  penguji_eksternal_kode: string | null
  penguji_eksternal: string
  link: string // optional material link (Google Drive); '' = none
  confirmOverride: boolean
  overrideReason: string
}

export type DefenseClashSummary = {
  type: DefenseClashType | 'mengajar'
  policy: ClashPolicy
  detail: string
  label: string // the other student, or the course being taught
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  overlapMinutes: number
}

export type DefenseClashResult = { clashes: DefenseClashSummary[]; blocking: boolean }

/** akunBaru: a day login made by this save (password shown once). akunError: the save stands, the login didn't get made. */
export type AkunBaru = { username: string; password: string; nama: string; tanggal: string }
export type DefenseFormState =
  | { error: string }
  | { success: true; akunBaru?: AkunBaru; akunError?: string }
  | { needsOverride: true; clashes: DefenseClashSummary[] }

const CAND = 'cand'

function candidateOf(i: DefenseInput): DefenseClashInput {
  return {
    id: CAND,
    prodi: i.prodi,
    jenis: i.jenis,
    tanggal: i.tanggal,
    jam_mulai: i.jam_mulai,
    jam_selesai: i.jam_selesai,
    room_id: i.room_id,
    kelompok: null,
    npm: i.npm,
    nama_mahasiswa: i.nama_mahasiswa,
    pembimbing_kode: i.pembimbing_kode,
    penguji_kode: i.penguji_kode,
    penguji_eksternal_kode: i.jenis === 'sidang' ? i.penguji_eksternal_kode : null,
    penguji_eksternal: i.jenis === 'sidang' && !i.penguji_eksternal_kode ? i.penguji_eksternal : '',
  }
}

/** Clashes this defense would cause, against every other defense in the academic year and the kuliah schedule. */
export async function checkDefenseClashes(input: DefenseInput): Promise<DefenseClashResult> {
  if (!input.tanggal || !input.jam_mulai || !input.jam_selesai) return { clashes: [], blocking: false }

  const world = await loadDefenseWorld(input.academic_year_id, input.prodi)
  const cand = candidateOf(input)
  const others = world.defenses.filter((d) => d.id !== input.id)

  const clashes: DefenseClashSummary[] = []
  for (const x of findDefenseClashes([...others, cand], world.names, world.roomNames)) {
    const other = x.a.id === CAND ? x.b : x.b.id === CAND ? x.a : null
    if (!other) continue
    const policy = x.type === 'ruangan' ? world.policies.ruangan : world.policies.dosen
    if (policy === 'abaikan') continue
    clashes.push({ type: x.type, policy, detail: x.detail, label: prodiTag(input.prodi, other.prodi) + other.nama_mahasiswa, tanggal: other.tanggal, jam_mulai: other.jam_mulai, jam_selesai: other.jam_selesai, overlapMinutes: x.overlapMinutes })
  }
  if (world.policies.dosen !== 'abaikan') {
    for (const t of findTeachingOverlaps([cand], world.teaching)) {
      clashes.push({
        type: 'mengajar',
        policy: 'peringatan', // kuliah weeks may alternate, so this is never a block
        detail: world.names.get(t.kode_dosen) ?? t.kode_dosen,
        label: `${prodiTag(input.prodi, t.teaching.prodi)}${t.teaching.nama_mk} (Kelas ${t.teaching.kelas})`,
        tanggal: cand.tanggal,
        jam_mulai: t.teaching.jam_mulai,
        jam_selesai: t.teaching.jam_selesai,
        overlapMinutes: t.overlapMinutes,
      })
    }
  }
  return { clashes, blocking: clashes.some((c) => c.policy === 'blok') }
}

export type DefenseSide = { id: string; prodi: Prodi; jenis: DefenseJenis; tanggal: string; jam_mulai: string; jam_selesai: string; npm: string; nama_mahasiswa: string }

export type DefenseFinding = {
  type: DefenseClashType | 'mengajar'
  policy: ClashPolicy
  detail: string
  overlapMinutes: number
  a: DefenseSide
  b: DefenseSide | null // null for a teaching overlap
  teaching?: string
}

const sideOf = (d: DefenseClashInput): DefenseSide => ({ id: d.id, prodi: d.prodi, jenis: d.jenis, tanggal: d.tanggal, jam_mulai: d.jam_mulai, jam_selesai: d.jam_selesai, npm: d.npm, nama_mahasiswa: d.nama_mahasiswa })

/** The standing findings-bar view: every clash among the saved defenses of the academic year. */
export async function checkAllDefenseClashes(academicYearId: string, prodi: Prodi): Promise<DefenseFinding[]> {
  if (!academicYearId) return []
  const world = await loadDefenseWorld(academicYearId, prodi)

  const findings: DefenseFinding[] = findDefenseClashes(world.defenses, world.names, world.roomNames)
    .map((x) => ({ type: x.type, policy: x.type === 'ruangan' ? world.policies.ruangan : world.policies.dosen, detail: x.detail, overlapMinutes: x.overlapMinutes, a: sideOf(x.a), b: sideOf(x.b) }))
    .filter((f) => f.policy !== 'abaikan')

  if (world.policies.dosen !== 'abaikan') {
    for (const t of findTeachingOverlaps(world.defenses, world.teaching)) {
      findings.push({
        type: 'mengajar',
        policy: 'peringatan',
        detail: world.names.get(t.kode_dosen) ?? t.kode_dosen,
        overlapMinutes: t.overlapMinutes,
        a: sideOf(t.defense),
        b: null,
        teaching: `${prodiTag(prodi, t.teaching.prodi)}${t.teaching.nama_mk} (Kelas ${t.teaching.kelas})`,
      })
    }
  }
  const own = findings
    .map((f) => orientFinding(prodi, f))
    .filter((f): f is DefenseFinding => f !== null)
    .map((f) => (f.b ? { ...f, b: { ...f.b, nama_mahasiswa: prodiTag(prodi, f.b.prodi) + f.b.nama_mahasiswa } } : f))
  return own.sort((a, b) => a.a.tanggal.localeCompare(b.a.tanggal) || a.a.jam_mulai.localeCompare(b.a.jam_mulai))
}

const EKSTERNAL_ERROR = 'Dosen eksternal hanya dapat menjadi Anggota Penguji I.'

function validate(i: DefenseInput): string | null {
  if (!parseProdi(i.prodi)) return 'Prodi tidak dikenali.'
  if (!i.academic_year_id) return 'Pilih tahun akademik.'
  if (i.jenis !== 'prasidang' && i.jenis !== 'sidang') return `Pilih jenis (${jenisLabel(i.prodi, 'prasidang').toLowerCase()} atau ${jenisLabel(i.prodi, 'sidang').toLowerCase()}).`
  if (!i.tanggal) return 'Tanggal wajib diisi.'
  if (!i.jam_mulai || !i.jam_selesai) return 'Jam mulai dan jam selesai wajib diisi.'
  if (i.jam_selesai <= i.jam_mulai) return 'Jam selesai harus setelah jam mulai.'
  if (!/^\d+$/.test(i.npm.trim())) return 'Pilih mahasiswa dari Data Master Mahasiswa.'
  if (!i.room_id) return `Pilih ruang ${jenisLabel(i.prodi, i.jenis).toLowerCase()}.`
  const dosen = [i.pembimbing_kode, i.penguji_kode, i.jenis === 'sidang' ? i.penguji_eksternal_kode : null].filter(Boolean)
  if (new Set(dosen).size < dosen.length) return 'Satu dosen tidak boleh memegang dua peran pada mahasiswa yang sama.'
  // normalizeDefenseLink: '' stays '', a real URL is trimmed, everything else is invalid —
  // this field becomes a target=_blank button on a public page, so only http(s) may pass.
  if (normalizeDefenseLink(i.link) === null) return 'Link harus dimulai dengan http:// atau https://.'
  return null
}

export async function saveDefenseAction(input: DefenseInput): Promise<DefenseFormState> {
  const invalid = validate(input)
  if (invalid) return { error: invalid }
  const gate = await writableProdi(input.prodi)
  if ('error' in gate) return { error: gate.error }

  const supabase = await createClient()
  // Nama and judul come from the master when the student is picked, then stay as scheduled: a
  // saved entry keeps them (history), a changed judul is a new prasidang.
  const { data: existing } = input.id ? await supabase.from('defenses').select('npm, pembimbing_kode, penguji_kode').eq('id', input.id).maybeSingle() : { data: null }
  // Dosen eksternal: Anggota Penguji I only, in both jenis and both prodi. A row saved before the rule
  // keeps its old dosen (flagged on the page, not blocked): only a dosen newly put in a role is checked.
  const roleCodes = [
    input.pembimbing_kode !== existing?.pembimbing_kode ? input.pembimbing_kode : null,
    input.penguji_kode !== existing?.penguji_kode ? input.penguji_kode : null,
  ].filter((k): k is string => !!k)
  if (roleCodes.length) {
    const { count, error: eksternalError } = await supabase.from('lecturers').select('kode_dosen', { count: 'exact', head: true }).in('kode_dosen', roleCodes).eq('eksternal', true)
    if (eksternalError) return { error: humanDbError(eksternalError) }
    if (count) return { error: EKSTERNAL_ERROR }
  }
  const kept = existing?.npm === input.npm.trim()
  const { data: student } = kept ? { data: null } : await supabase.from('students').select('nama, judul_skripsi').eq('npm', input.npm.trim()).eq('prodi', input.prodi).maybeSingle()
  if (!kept && !student) return { error: `NPM ini belum ada di Data Master Mahasiswa ${PRODI_CONFIG[input.prodi].short}. Tambahkan dulu di sana.` }

  const check = await checkDefenseClashes(input)
  let overridden = false
  if (check.blocking) {
    if (!(input.confirmOverride && input.overrideReason.trim())) return { needsOverride: true, clashes: check.clashes }
    const world = await loadDefenseWorld(input.academic_year_id, input.prodi)
    if (!world.izinkanOverride) return { error: 'Jadwal ini bentrok dan fitur terobos bentrok sedang dinonaktifkan di Pengaturan.' }
    overridden = true
  }

  const sidang = input.jenis === 'sidang'
  const row = {
    academic_year_id: input.academic_year_id,
    prodi: input.prodi,
    jenis: input.jenis,
    tanggal: input.tanggal,
    jam_mulai: input.jam_mulai,
    jam_selesai: input.jam_selesai,
    room_id: input.room_id,
    kelompok: null, // rooms replaced kelompok; saving a legacy row moves it to its room
    npm: input.npm.trim(),
    ...(student && { nama_mahasiswa: student.nama, judul_skripsi: student.judul_skripsi }),
    pembimbing_kode: input.pembimbing_kode || null,
    penguji_kode: input.penguji_kode || null,
    penguji_eksternal_kode: sidang ? input.penguji_eksternal_kode || null : null,
    penguji_eksternal: sidang && !input.penguji_eksternal_kode ? input.penguji_eksternal.trim() : '',
    link: normalizeDefenseLink(input.link) ?? '',
    is_override: overridden,
    override_reason: overridden ? input.overrideReason.trim() : '',
    override_by: overridden ? ((await supabase.auth.getUser()).data.user?.id ?? null) : null,
  }

  const { error } = input.id ? await supabase.from('defenses').update(row).eq('id', input.id).eq('prodi', gate.prodi) : await supabase.from('defenses').insert(row)
  if (error) return { error: humanDbError(error, 'NPM ini pada jenis ujian yang sama') }

  revalidatePath('/[prodi]/sidang', 'page')
  return { success: true, ...(await akunPenguji(supabase, row)) }
}

/**
 * An eksternal Anggota Penguji I on an S1 sidang gets a day login for that date. Runs after the save
 * and never undoes it: a failure comes back as akunError for the form to show.
 */
async function akunPenguji(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: { prodi: string; jenis: string; tanggal: string; penguji_eksternal_kode: string | null },
): Promise<{ akunBaru?: AkunBaru; akunError?: string }> {
  const kode = row.penguji_eksternal_kode
  if (!kode || !bisaDinilaiSidang(row)) return {}
  try {
    const { data: dosen, error } = await supabase.from('lecturers').select('nama, eksternal').eq('kode_dosen', kode).maybeSingle()
    if (error) throw new Error(humanDbError(error))
    if (!dosen?.eksternal) return {}
    const akun = await ensureAkunEksternal(createAdminClient(), kode, row.tanggal)
    if (!akun.created) return {}
    return { akunBaru: { username: akun.username, password: akun.password, nama: dosen.nama, tanggal: row.tanggal } }
  } catch (e) {
    return { akunError: `Jadwal tersimpan, tetapi akun penguji eksternal belum dibuat: ${(e as Error).message} Simpan ulang jadwal ini untuk mencoba lagi.` }
  }
}

export async function deleteDefenseAction(prodi: Prodi, id: string): Promise<DefenseFormState> {
  const gate = await writableProdi(prodi)
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const { error } = await supabase.from('defenses').delete().eq('id', id).eq('prodi', gate.prodi)
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/sidang', 'page')
  return { success: true }
}

/**
 * Super Admin deletes a prasidang whose berita acara is filled, or a sidang already graded (S1 or S2), after typing the
 * student's NPM. The DB function checks the role and the NPM again and deletes everything in one transaction; the
 * audit log keeps the deleted rows.
 */
export async function hapusPaksaAction(jenis: 'prasidang' | 'sidang', id: string, npm: string): Promise<DefenseFormState> {
  if (!canManage(await getCurrentRole())) return { error: 'Hanya Super Admin yang dapat menghapus jadwal yang sudah dinilai.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc(jenis === 'sidang' ? 'hapus_sidang_paksa' : 'hapus_prasidang_paksa', { p_id: id, p_npm: npm })
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/sidang', 'page')
  return { success: true }
}

/** Sidang form (S1 and S2): the student's gate status (status_prasidang) and Dosen Pembimbing I/II. Null when unknown. */
export async function infoMahasiswaSidangAction(
  npm: string,
): Promise<{ status: StatusPrasidang; pembimbing_1_kode: string | null; pembimbing_2_kode: string | null; tanpa_pembimbing_2: boolean } | null> {
  if (!/^\d+$/.test(npm.trim())) return null
  const supabase = await createClient()
  const [status, mhs] = await Promise.all([
    supabase.rpc('status_prasidang', { p_npm: npm.trim() }),
    // NPM is unique across both prodi.
    supabase.from('students').select('pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2').eq('npm', npm.trim()).maybeSingle(),
  ])
  if (status.error || mhs.error || !status.data) return null
  return {
    status: status.data as StatusPrasidang,
    pembimbing_1_kode: mhs.data?.pembimbing_1_kode ?? null,
    pembimbing_2_kode: mhs.data?.pembimbing_2_kode ?? null,
    tanpa_pembimbing_2: !!mhs.data?.tanpa_pembimbing_2,
  }
}

/** The pembimbing from the student's latest earlier defense (any year), so a sidang starts from their prasidang. */
export async function lookupPembimbingAction(npm: string): Promise<{ pembimbing_kode: string; from: string } | null> {
  if (!/^\d+$/.test(npm.trim())) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('defenses')
    .select('pembimbing_kode, prodi, jenis, tanggal')
    .eq('npm', npm.trim())
    .not('pembimbing_kode', 'is', null)
    .order('tanggal', { ascending: false })
    .limit(1)
  const d = data?.[0]
  if (!d) return null
  const tanggal = new Date(`${d.tanggal}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return { pembimbing_kode: d.pembimbing_kode, from: `${jenisLabel(d.prodi as Prodi, d.jenis as DefenseJenis).toLowerCase()} ${tanggal}` }
}
