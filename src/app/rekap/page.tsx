import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { lecturerDisplayName } from '@/lib/import/tables'
import { buildRekapData } from './rekap-data'
import { letterSections, sumSks } from './letter-rows'
import { RekapClient } from './RekapClient'
import type { AcademicYear, Lecturer } from '../penjadwalan-types'

export default async function RekapPage(props: PageProps<'/rekap'>) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const [{ data: academicYears }, { data: lecturers }] = await Promise.all([
    supabase.from('academic_years').select('*').order('id', { ascending: false }),
    supabase.from('lecturers').select('*').order('nama'),
  ])

  const years = (academicYears as AcademicYear[]) ?? []
  const defaultYear = years.find((y) => y.is_active)?.id ?? years[0]?.id ?? ''
  const academicYearId = (searchParams.ay as string) || defaultYear
  const selectedDosen = (searchParams.dosen as string) || 'all'
  // Same resolution the letter itself uses, so "nothing to rekap" never disagrees with the document.
  const data = await buildRekapData({ ay: academicYearId, dosen: selectedDosen })

  const index = data.lecturersWithLoad.map((l) => {
    const rows = data.byDosen.get(l.kode_dosen) ?? []
    return { kode_dosen: l.kode_dosen, nama: lecturerDisplayName(l), jadwal: rows.length, sks: sumSks(rows) }
  })
  const selected = selectedDosen === 'all' ? null : data.lecturersToRender[0]
  const at = selected ? index.findIndex((r) => r.kode_dosen === selected.kode_dosen) : -1
  const letter = selected
    ? {
        nama: index[at].nama,
        sections: letterSections(data.byDosen.get(selected.kode_dosen) ?? []),
        totalSks: index[at].sks,
        jadwal: index[at].jadwal,
        position: at + 1,
        total: index.length,
        prev: index[at - 1]?.kode_dosen ?? null,
        next: index[at + 1]?.kode_dosen ?? null,
      }
    : null

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/rekap" />
      <RekapClient
        academicYears={years}
        lecturers={(lecturers as Lecturer[]) ?? []}
        academicYearId={academicYearId}
        selectedDosen={selectedDosen}
        hasLetters={data.lecturersToRender.length > 0}
        index={index}
        letter={letter}
        facts={{
          kota: data.kota,
          namaFakultas: data.namaFakultas,
          kopLines: data.kopLines,
          nomorSurat: data.nomorSurat,
          lampiranSurat: data.lampiranSurat,
          perihalSurat: data.perihalSurat,
          catatanPerkuliahan: data.catatanPerkuliahan,
          namaDekan: data.namaDekan,
          jabatanDekan: data.jabatanDekan,
          hasTandaTangan: Boolean(data.gambarTandaTanganDekan),
          tembusanLines: data.tembusanLines,
        }}
      />
    </div>
  )
}
