import { createClient } from '@/lib/supabase/server'
import { getSettings, settingText } from '@/lib/settings'
import { fetchSchedulesForYear } from '../schedule-query'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'

/** Same data/settings a Rekap Dosen (Surat Penugasan) export needs, resolved from raw query-string values. */
export async function buildRekapData(params: { ay?: string | null; dosen?: string | null }) {
  const supabase = await createClient()
  const [{ data: academicYears }, { data: lecturers }, settings] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
    getSettings(),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const academicYearId = params.ay || defaultYear
  const selectedDosen = params.dosen || 'all'

  const schedules = await fetchSchedulesForYear(academicYearId)

  const byDosen = new Map<string, typeof schedules>()
  for (const s of schedules) {
    for (const sl of s.schedule_lecturers) {
      if (!sl.lecturers) continue
      const list = byDosen.get(sl.lecturers.kode_dosen) ?? []
      list.push(s)
      byDosen.set(sl.lecturers.kode_dosen, list)
    }
  }

  const allLecturers = (lecturers as Lecturer[]) ?? []
  const lecturersWithLoad = allLecturers.filter((l) => byDosen.has(l.kode_dosen)).sort((a, b) => a.nama.localeCompare(b.nama))
  const lecturersToRender = selectedDosen === 'all' ? lecturersWithLoad : lecturersWithLoad.filter((l) => l.kode_dosen === selectedDosen)

  const year = years.find((y) => y.id === academicYearId)
  const label = year?.label ?? ''
  const space = label.indexOf(' ')
  const tahun = space === -1 ? label : label.slice(0, space)
  const term = space === -1 ? '' : label.slice(space + 1).toUpperCase()

  return {
    academicYearId,
    academicYearLabel: label,
    tahun,
    term,
    lecturersToRender,
    byDosen,
    namaFakultas: settingText(settings, 'nama_fakultas', ''),
    kota: settingText(settings, 'kota', ''),
    kopLines: settingText(settings, 'kop_baris', '').split('\n').filter(Boolean),
    nomorSurat: settingText(settings, 'nomor_surat', ''),
    lampiranSurat: settingText(settings, 'lampiran_surat', ''),
    perihalSurat: settingText(settings, 'perihal_surat', ''),
    catatanPerkuliahan: settingText(settings, 'catatan_perkuliahan', ''),
    namaDekan: settingText(settings, 'nama_dekan', ''),
    jabatanDekan: settingText(settings, 'jabatan_dekan', ''),
    gambarTandaTanganDekan: settingText(settings, 'gambar_tanda_tangan_dekan', ''),
    tembusanLines: settingText(settings, 'tembusan', '').split('\n').filter(Boolean),
    ukuranKertas: settingText(settings, 'ukuran_kertas', 'A4'),
    orientasi: settingText(settings, 'orientasi', 'portrait'),
  }
}

export type RekapData = Awaited<ReturnType<typeof buildRekapData>>
