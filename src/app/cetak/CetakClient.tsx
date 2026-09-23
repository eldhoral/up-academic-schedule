'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { lecturerDisplayName } from '@/lib/import/tables'
import type { AcademicYear, ScheduleRow } from '../penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export function CetakClient({
  academicYears,
  schedules,
  context,
  headerLines,
  zoomId,
  zoomPasscode,
  keteranganLines,
  kota,
  namaPenandatangan,
  jabatanPenandatangan,
  gambarTandaTangan,
  pageStyle,
}: {
  academicYears: AcademicYear[]
  schedules: ScheduleRow[]
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
  headerLines: string[]
  zoomId: string
  zoomPasscode: string
  keteranganLines: string[]
  kota: string
  namaPenandatangan: string
  jabatanPenandatangan: string
  gambarTandaTangan: string
  pageStyle: string
}) {
  const router = useRouter()

  function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    router.push(`/cetak?${params.toString()}`)
  }

  const byKelas = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    const list = byKelas.get(s.kelas) ?? []
    list.push(s)
    byKelas.set(s.kelas, list)
  }
  const kelasGroups = Array.from(byKelas.entries()).sort(([a], [b]) => a.localeCompare(b))

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />

      <div className="no-print min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis Kelas
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Cetak
        </button>
      </div>

      <div className="print-sheet mx-auto bg-white text-black p-[1.5cm]" style={{ maxWidth: '21cm' }}>
        <header className="text-center mb-[1rem]">
          {headerLines.map((line, i) => (
            <p key={i} className="m-0 font-bold text-[13pt] leading-[1.4]">
              {line}
            </p>
          ))}
          <p className="m-0 font-bold text-[13pt] leading-[1.4]">
            ID ZOOM : {zoomId}
            {zoomPasscode && <>&nbsp;&nbsp;&nbsp;&nbsp;PASSCODE : {zoomPasscode}</>}
          </p>
        </header>

        {kelasGroups.length === 0 && <p className="text-center text-[11pt] py-[2rem]">Tidak ada data jadwal untuk pilihan ini.</p>}

        {kelasGroups.map(([kelas, rows]) => (
          <table key={kelas} className="w-full border-collapse mb-[1rem] text-[10pt]">
            <thead>
              <tr>
                <Th w="10%">KODE MK</Th>
                <Th w="26%">MATA KULIAH</Th>
                <Th w="6%" center>
                  SKS
                </Th>
                <Th w="10%">HARI</Th>
                <Th w="14%">JAM</Th>
                <Th w="20%">NAMA DOSEN</Th>
                <Th w="8%">RUANGAN</Th>
                <Th w="6%">ZOOM</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="border border-black text-center font-bold py-[0.15rem]">
                  KELAS {kelas}
                </td>
              </tr>
              {rows
                .sort((a, b) => a.hari.localeCompare(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
                .map((r) => {
                  const suffix = r.minggu === 'ganjil' ? ' (A)' : r.minggu === 'genap' ? ' (B)' : ''
                  const dosen =
                    r.schedule_lecturers.length === 0
                      ? 'MKWU'
                      : r.schedule_lecturers
                          .sort((a, b) => a.urutan - b.urutan)
                          .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : ''))
                          .join(', ')
                  return (
                    <tr key={r.id}>
                      <Td>{r.kode_mk}</Td>
                      <Td>
                        {r.courses?.nama_mk ?? r.kode_mk}
                        {suffix}
                      </Td>
                      <Td center>{r.courses?.sks ?? ''}</Td>
                      <Td>{r.hari}</Td>
                      <Td>
                        {r.jam_mulai.slice(0, 5)} - {r.jam_selesai.slice(0, 5)}
                      </Td>
                      <Td>{dosen}</Td>
                      <Td>{r.rooms?.nama ?? ''}</Td>
                      <Td>{r.zoom_id || ''}</Td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        ))}

        <div className="mt-[1rem] text-[10pt]">
          <p className="font-bold m-0">KETERANGAN:</p>
          {keteranganLines.map((line, i) => (
            <p key={i} className="m-0">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-[2.5rem] text-right text-[10pt]" style={{ marginLeft: '55%' }}>
          <p className="m-0">
            {kota}, {today}
          </p>
          <p className="m-0 mt-[0.3rem]">{jabatanPenandatangan}</p>
          {gambarTandaTangan ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gambarTandaTangan} alt="" className="h-[3.2cm] mx-auto" />
          ) : (
            <div className="h-[2cm]" />
          )}
          <p className="m-0 font-bold underline">{namaPenandatangan}</p>
        </div>
      </div>
    </div>
  )
}

function Th({ children, w, center }: { children: React.ReactNode; w: string; center?: boolean }) {
  return (
    <th
      style={{ width: w, textAlign: center ? 'center' : 'left' }}
      className="border border-black px-[0.3rem] py-[0.2rem] font-bold text-[10pt]"
    >
      {children}
    </th>
  )
}

function Td({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <td style={{ textAlign: center ? 'center' : 'left' }} className="border border-black px-[0.3rem] py-[0.15rem]">
      {children}
    </td>
  )
}
