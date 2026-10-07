'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { orientFinding } from '@/lib/clash'
import { parseProdi, prodiTag, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'
import { findDefenseClashes, findTeachingOverlaps, type DefenseClashInput, type DefenseClashType } from './defense-clash'
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
  room_id: string | null // sidang
  kelompok: number | null // prasidang
  npm: string
  nama_mahasiswa: string
  judul_skripsi: string
  pembimbing_kode: string | null
  penguji_kode: string | null
  penguji_eksternal: string
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

export type DefenseFormState = { error: string } | { success: true } | { needsOverride: true; clashes: DefenseClashSummary[] }

const CAND = 'cand'

function candidateOf(i: DefenseInput): DefenseClashInput {
  return {
    id: CAND,
    prodi: i.prodi,
    jenis: i.jenis,
    tanggal: i.tanggal,
    jam_mulai: i.jam_mulai,
    jam_selesai: i.jam_selesai,
    room_id: i.jenis === 'sidang' ? i.room_id : null,
    kelompok: i.jenis === 'prasidang' ? i.kelompok : null,
    npm: i.npm,
    nama_mahasiswa: i.nama_mahasiswa,
    pembimbing_kode: i.pembimbing_kode,
    penguji_kode: i.penguji_kode,
    penguji_eksternal: i.jenis === 'sidang' ? i.penguji_eksternal : '',
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

function validate(i: DefenseInput): string | null {
  if (!parseProdi(i.prodi)) return 'Prodi tidak dikenali.'
  if (!i.academic_year_id) return 'Pilih tahun akademik.'
  if (i.jenis !== 'prasidang' && i.jenis !== 'sidang') return `Pilih jenis (${jenisLabel(i.prodi, 'prasidang').toLowerCase()} atau ${jenisLabel(i.prodi, 'sidang').toLowerCase()}).`
  if (!i.tanggal) return 'Tanggal wajib diisi.'
  if (!i.jam_mulai || !i.jam_selesai) return 'Jam mulai dan jam selesai wajib diisi.'
  if (i.jam_selesai <= i.jam_mulai) return 'Jam selesai harus setelah jam mulai.'
  if (!/^\d+$/.test(i.npm.trim())) return 'Pilih mahasiswa dari Data Master Mahasiswa.'
  if (i.jenis === 'sidang' && !i.room_id) return `Pilih ruang ${jenisLabel(i.prodi, 'sidang').toLowerCase()}.`
  if (i.jenis === 'prasidang' && !(i.kelompok && i.kelompok > 0)) return `Kelompok ${jenisLabel(i.prodi, 'prasidang').toLowerCase()} wajib diisi.`
  if (i.pembimbing_kode && i.pembimbing_kode === i.penguji_kode) return 'Satu dosen tidak boleh memegang dua peran pada mahasiswa yang sama.'
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
  const { data: existing } = input.id ? await supabase.from('defenses').select('npm').eq('id', input.id).maybeSingle() : { data: null }
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
    room_id: sidang ? input.room_id : null,
    kelompok: sidang ? null : input.kelompok,
    npm: input.npm.trim(),
    ...(student && { nama_mahasiswa: student.nama, judul_skripsi: student.judul_skripsi }),
    pembimbing_kode: input.pembimbing_kode || null,
    penguji_kode: input.penguji_kode || null,
    penguji_eksternal: sidang ? input.penguji_eksternal.trim() : '',
    is_override: overridden,
    override_reason: overridden ? input.overrideReason.trim() : '',
    override_by: overridden ? ((await supabase.auth.getUser()).data.user?.id ?? null) : null,
  }

  const { error } = input.id ? await supabase.from('defenses').update(row).eq('id', input.id).eq('prodi', gate.prodi) : await supabase.from('defenses').insert(row)
  if (error) return { error: humanDbError(error, 'NPM ini pada jenis ujian yang sama') }

  revalidatePath('/[prodi]/sidang', 'page')
  return { success: true }
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

/** The pembimbing from the student's latest earlier defense (any year), so a sidang starts from their prasidang. */
export async function lookupPembimbingAction(npm: string): Promise<{ pembimbing_kode: string; from: string } | null> {
  if (!/^\d+$/.test(npm.trim())) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('defenses')
    .select('pembimbing_kode, jenis, tanggal')
    .eq('npm', npm.trim())
    .not('pembimbing_kode', 'is', null)
    .order('tanggal', { ascending: false })
    .limit(1)
  const d = data?.[0]
  if (!d) return null
  const tanggal = new Date(`${d.tanggal}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return { pembimbing_kode: d.pembimbing_kode, from: `${d.jenis} ${tanggal}` }
}
