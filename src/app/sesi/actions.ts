'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateDaySessions, type GeneratedSlot } from '@/lib/sesi-generator'
import { getSettings, settingInt, settingText } from '@/lib/settings'
import { HARI_DB as HARI_VALUES } from '@/lib/hari'

export type FormState = { error: string } | { success: true } | null

export type GeneratorInput = {
  hari: string
  startJam: string
  pattern: string // comma list, e.g. "2,2,3"
  jedaMenit: number
  replaceDay: boolean
}

export type GeneratorResult = { ok: true; preview: GeneratedSlot[] } | { ok: false; error: string }

export async function previewGeneratedSessions(input: GeneratorInput): Promise<GeneratorResult> {
  if (!(HARI_VALUES as readonly string[]).includes(input.hari)) return { ok: false, error: 'Pick a valid hari.' }
  if (!/^\d{1,2}:\d{2}$/.test(input.startJam)) return { ok: false, error: 'Jam mulai must be HH:MM.' }

  const pattern = input.pattern
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (pattern.length === 0) return { ok: false, error: 'SKS pattern needs at least one positive number, e.g. "2,2,3".' }

  const settings = await getSettings()
  const menitPerSks = settingInt(settings, 'menit_per_sks', 50)
  const istirahatMulai = settingText(settings, 'jam_istirahat_mulai', '12:10')
  const istirahatSelesai = settingText(settings, 'jam_istirahat_selesai', '13:00')

  let startSesiKe = 1
  if (!input.replaceDay) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('sessions')
      .select('sesi_ke')
      .eq('hari', input.hari)
      .order('sesi_ke', { ascending: false })
      .limit(1)
    startSesiKe = ((data?.[0]?.sesi_ke as number) ?? 0) + 1
  }

  const preview = generateDaySessions({
    startJam: input.startJam,
    pattern,
    jedaMenit: input.jedaMenit,
    menitPerSks,
    istirahatMulai,
    istirahatSelesai,
    startSesiKe,
  })

  return { ok: true, preview }
}

export async function commitGeneratedSessions(
  hari: string,
  replaceDay: boolean,
  slots: GeneratedSlot[]
): Promise<GeneratorResult> {
  if (slots.length === 0) return { ok: false, error: 'Nothing to save.' }

  const supabase = await createClient()

  if (replaceDay) {
    const { error } = await supabase.from('sessions').delete().eq('hari', hari)
    if (error) return { ok: false, error: error.message }
  }

  const rows = slots.map((s) => ({
    hari,
    sesi_ke: s.sesi_ke,
    jam_mulai: s.jam_mulai,
    jam_selesai: s.jam_selesai,
    sks: s.sks,
    active: true,
  }))

  const { error } = await supabase.from('sessions').insert(rows)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/sesi')
  return { ok: true, preview: slots }
}

function readSessionForm(formData: FormData) {
  const hari = formData.get('hari') as string
  const sesi_ke = parseInt(formData.get('sesi_ke') as string, 10)
  const jam_mulai = formData.get('jam_mulai') as string
  const jam_selesai = formData.get('jam_selesai') as string
  const sks = parseInt(formData.get('sks') as string, 10)
  const active = formData.get('active') === 'on'
  return { hari, sesi_ke, jam_mulai, jam_selesai, sks, active }
}

export async function updateSessionAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const row = readSessionForm(formData)
  if (!row.jam_mulai || !row.jam_selesai) return { error: 'jam_mulai and jam_selesai are required.' }
  if (row.jam_selesai <= row.jam_mulai) return { error: 'jam_selesai must be after jam_mulai.' }

  const supabase = await createClient()
  const { error } = await supabase.from('sessions').update(row).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/sesi')
  return { success: true }
}

export async function deleteSessionAction(id: string): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/sesi')
  return { success: true }
}
