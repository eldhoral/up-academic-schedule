'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { managerOnly } from '@/lib/prodi-server'
import {
  validateAspek, validatePredikat, validateSks, validateTabelNilai, validateTanggal,
  type Aspek, type BarisNilai, type BarisPredikat,
} from '@/lib/penilaian/aturan'

export type Kunci = 'aspek_bimbingan' | 'tabel_nilai' | 'predikat' | 'sks_skripsi' | 'tanggal_mulai_penilaian'
export type Hasil = { error: string } | { ok: true }

const BENTUK = 'Data tidak berbentuk benar. Muat ulang halaman lalu coba lagi.'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const rows = (v: unknown): Record<string, unknown>[] | null => (Array.isArray(v) && v.every(isObj) ? v : null)

/** Shape check, then the same validate* the editor shows inline. Returns the value to store. */
function periksa(kunci: Kunci, value: unknown): { error: string } | { nilai: unknown } {
  const r = rows(value)
  if (kunci === 'aspek_bimbingan') {
    if (!r || !r.every((x) => isStr(x.label) && isNum(x.bobot) && Array.isArray(x.sub) && x.sub.every(isStr))) return { error: BENTUK }
    const a: Aspek[] = r.map((x) => ({
      label: (x.label as string).trim(), bobot: x.bobot as number,
      sub: (x.sub as string[]).map((s) => s.trim()).filter(Boolean),
    }))
    return validateAspek(a) ? { error: validateAspek(a)! } : { nilai: a }
  }
  if (kunci === 'tabel_nilai') {
    if (!r || !r.every((x) => isNum(x.min) && isStr(x.huruf) && isNum(x.mutu))) return { error: BENTUK }
    const t: BarisNilai[] = r.map((x) => ({ min: x.min as number, huruf: (x.huruf as string).trim(), mutu: x.mutu as number }))
    return validateTabelNilai(t) ? { error: validateTabelNilai(t)! } : { nilai: t }
  }
  if (kunci === 'predikat') {
    if (!r || !r.every((x) => isNum(x.min) && isNum(x.max) && isStr(x.predikat) && typeof x.butuhTepatWaktu === 'boolean')) return { error: BENTUK }
    const p: BarisPredikat[] = r.map((x) => ({
      min: x.min as number, max: x.max as number, predikat: (x.predikat as string).trim(), butuhTepatWaktu: x.butuhTepatWaktu as boolean,
    }))
    return validatePredikat(p) ? { error: validatePredikat(p)! } : { nilai: p }
  }
  if (kunci === 'sks_skripsi') {
    if (!isNum(value)) return { error: BENTUK }
    return validateSks(value) ? { error: validateSks(value)! } : { nilai: value }
  }
  if (!isStr(value)) return { error: BENTUK }
  return validateTanggal(value) ? { error: validateTanggal(value)! } : { nilai: value }
}

const KUNCI: readonly string[] = ['aspek_bimbingan', 'tabel_nilai', 'predikat', 'sks_skripsi', 'tanggal_mulai_penilaian']

/** Super Admin, S1 only. Writes on the session client so the audit log names the real actor. */
export async function saveAturanAction(kunci: Kunci, value: unknown): Promise<Hasil> {
  const denied = await managerOnly()
  if (denied) return denied
  if (!KUNCI.includes(kunci)) return { error: 'Aturan tidak dikenali.' }

  const cek = periksa(kunci, value)
  if ('error' in cek) return cek

  const supabase = await createClient()
  const { error } = await supabase.from('aturan_penilaian').upsert({ prodi: 's1', kunci, nilai: cek.nilai }, { onConflict: 'prodi,kunci' })
  if (error) return { error: humanDbError(error) }

  revalidatePath('/[prodi]/pengaturan/penilaian', 'page')
  return { ok: true }
}
