'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { lecturerDisplayName } from '@/lib/import/tables'
import { hariLabel } from '@/lib/hari'
import type { AcademicYear, Lecturer, ScheduleRow } from '../penjadwalan-types'

export function RekapClient({
  academicYears,
  lecturers,
  schedules,
  academicYearId,
  selectedDosen,
  namaProdi,
  pageStyle,
}: {
  academicYears: AcademicYear[]
  lecturers: Lecturer[]
  schedules: ScheduleRow[]
  academicYearId: string
  selectedDosen: string // kode_dosen, or 'all'
  namaProdi: string
  pageStyle: string
}) {
  const router = useRouter()

  function navigate(next: { ay?: string; dosen?: string }) {
    const params = new URLSearchParams({
      ay: next.ay ?? academicYearId,
      dosen: next.dosen ?? selectedDosen,
    })
    router.push(`/rekap?${params.toString()}`)
  }

  const byDosen = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    for (const sl of s.schedule_lecturers) {
      if (!sl.lecturers) continue
      const list = byDosen.get(sl.lecturers.kode_dosen) ?? []
      list.push(s)
      byDosen.set(sl.lecturers.kode_dosen, list)
    }
  }

  const lecturersWithLoad = lecturers.filter((l) => byDosen.has(l.kode_dosen)).sort((a, b) => a.nama.localeCompare(b.nama))
  const toPrint = selectedDosen === 'all' ? lecturersWithLoad : lecturersWithLoad.filter((l) => l.kode_dosen === selectedDosen)

  const year = academicYears.find((y) => y.id === academicYearId)

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />

      <div className="no-print min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Academic year
        </label>
        <Select
          id="ctx-ay"
          value={academicYearId}
          onValueChange={(v) => navigate({ ay: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-dosen">
          Dosen
        </label>
        <Select
          id="ctx-dosen"
          value={selectedDosen}
          onValueChange={(v) => navigate({ dosen: v })}
          options={[
            { value: 'all', label: `Semua dosen (${lecturersWithLoad.length})` },
            ...lecturersWithLoad.map((l) => ({ value: l.kode_dosen, label: lecturerDisplayName(l) })),
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem] max-w-[18rem]"
        />

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Print
        </button>
      </div>

      {toPrint.length === 0 && (
        <p className="text-center text-[0.93rem] text-[var(--tinta-3)] py-[2rem]">No teaching rows for this selection.</p>
      )}

      {toPrint.map((l, i) => (
        <div key={l.kode_dosen} className={`print-sheet mx-auto bg-white text-black p-[1.5cm] ${i > 0 ? 'rekap-break' : ''}`} style={{ maxWidth: '21cm' }}>
          <header className="text-center mb-[1rem]">
            <p className="m-0 font-bold text-[13pt]">REKAP MENGAJAR DOSEN</p>
            <p className="m-0 text-[11pt]">{namaProdi}</p>
            <p className="m-0 text-[11pt]">{year?.label}</p>
          </header>

          <p className="text-[11pt] mb-[0.6rem]">
            <b>{lecturerDisplayName(l)}</b>
            {l.nidn && <> &middot; NIDN {l.nidn}</>}
          </p>

          <RekapSection title="Kelas Reguler" rows={(byDosen.get(l.kode_dosen) ?? []).filter((s) => s.jenis_kelas === 'reguler')} />
          <RekapSection title="Kelas Reguler Khusus" rows={(byDosen.get(l.kode_dosen) ?? []).filter((s) => s.jenis_kelas === 'regsus')} />

          <p className="text-[11pt] font-bold text-right mt-[0.8rem]">
            Total SKS: {(byDosen.get(l.kode_dosen) ?? []).reduce((sum, s) => sum + (s.courses?.sks ?? 0), 0)}
          </p>
        </div>
      ))}
    </div>
  )
}

function RekapSection({ title, rows }: { title: string; rows: ScheduleRow[] }) {
  const subtotal = rows.reduce((sum, r) => sum + (r.courses?.sks ?? 0), 0)
  return (
    <div className="mb-[1rem]">
      <p className="text-[10pt] font-bold m-0 mb-[0.2rem]">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[10pt] text-gray-500 m-0">&mdash;</p>
      ) : (
        <table className="w-full border-collapse text-[10pt]">
          <thead>
            <tr>
              <Th w="12%">Kode MK</Th>
              <Th w="34%">Mata Kuliah</Th>
              <Th w="8%" center>
                SKS
              </Th>
              <Th w="8%" center>
                Kelas
              </Th>
              <Th w="14%">Hari</Th>
              <Th w="24%">Jam</Th>
            </tr>
          </thead>
          <tbody>
            {rows
              .sort((a, b) => a.hari.localeCompare(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
              .map((r) => (
                <tr key={r.id}>
                  <Td>{r.kode_mk}</Td>
                  <Td>{r.courses?.nama_mk ?? r.kode_mk}</Td>
                  <Td center>{r.courses?.sks ?? ''}</Td>
                  <Td center>{r.kelas}</Td>
                  <Td>{hariLabel(r.hari)}</Td>
                  <Td>
                    {r.jam_mulai.slice(0, 5)} - {r.jam_selesai.slice(0, 5)}
                  </Td>
                </tr>
              ))}
            <tr>
              <td colSpan={2} className="border border-black px-[0.3rem] py-[0.15rem] text-right font-bold">
                Subtotal
              </td>
              <Td center>
                <b>{subtotal}</b>
              </Td>
              <td className="border border-black" colSpan={3} />
            </tr>
          </tbody>
        </table>
      )}
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
