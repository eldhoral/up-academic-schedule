'use client'

import { useRouter } from 'next/navigation'
import { EmptySheet } from '@/components/EmptySheet'
import { BandRow, DocFacts, PreviewLayout, PreviewTable, cell } from '@/components/preview'
import { Select } from '@/components/Select'
import type { PengawasGroup } from '../pengawas-rows'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'
const COLUMNS = [
  { label: 'Hari', align: 'center' as const },
  { label: 'Tanggal', align: 'center' as const },
  { label: 'Jam', align: 'center' as const },
  { label: 'Kode MK', align: 'center' as const },
  { label: 'Mata Kuliah' },
  { label: 'Kelas', align: 'center' as const },
  { label: 'Program', align: 'center' as const },
  { label: 'Ruangan', align: 'center' as const },
  { label: 'Keterangan', align: 'center' as const },
]
const MONO = new Set([1, 2, 3, 5]) // TANGGAL, JAM, KODE MK, KELAS

export function RekapPengawasClient({
  academicYears,
  context,
  groups,
  totalTugas,
  headerLines,
  doc,
}: {
  academicYears: AcademicYear[]
  context: { academic_year_id: string; jenis_ujian: 'uts' | 'uas' }
  groups: PengawasGroup[]
  totalTugas: number
  headerLines: string[]
  doc: { namaPenandatangan: string; jabatanPenandatangan: string }
}) {
  const router = useRouter()
  const query = new URLSearchParams({ ay: context.academic_year_id, ujian: context.jenis_ujian }).toString()
  const yearLabel = academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? ''
  const ujian = context.jenis_ujian.toUpperCase()

  function navigate(next: Partial<typeof context>) {
    const m = { ...context, ...next }
    router.push(`/ujian/rekap?${new URLSearchParams({ ay: m.academic_year_id, ujian: m.jenis_ujian })}`)
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ujian">
          Ujian
        </label>
        <Select
          id="ctx-ujian"
          value={context.jenis_ujian}
          onValueChange={(v) => navigate({ jenis_ujian: v as 'uts' | 'uas' })}
          options={[
            { value: 'uts', label: 'UTS' },
            { value: 'uas', label: 'UAS' },
          ]}
          className={CONTROL}
        />

        {groups.length > 0 ? (
          <a
            href={`/ujian/rekap/xlsx?${query}`}
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
          >
            Unduh Excel
          </a>
        ) : (
          <span
            aria-disabled="true"
            title="Belum ada pengawas untuk diunduh"
            className="ml-auto inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru-disabled)] text-white font-medium cursor-not-allowed text-[0.93rem]"
          >
            Unduh Excel
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptySheet
          title="Belum ada pengawas ditugaskan"
          detail={`${ujian} · ${yearLabel} belum memiliki pengawas. Isi pengawas di Jadwal Ujian.`}
          actionHref={`/ujian?${new URLSearchParams({ ay: context.academic_year_id, ujian: context.jenis_ujian })}`}
          actionLabel="Buka Jadwal Ujian"
        />
      ) : (
        <PreviewLayout
          main={
            <section aria-label="Rekap pengawas">
              <header className="flex items-end justify-between gap-[1rem] flex-wrap pb-[0.67rem]">
                <div className="min-w-0">
                  <h2 className="m-0 text-[1.2rem] font-semibold tracking-[-0.01em] text-[var(--tinta)]">Rekap Pengawas {ujian}</h2>
                  <p className="m-0 text-[0.87rem] text-[var(--tinta-3)]">
                    {yearLabel} · {groups.length} pengawas · ujian Offline dan Ujian Lisan dihitung
                  </p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-[0.73rem] font-semibold uppercase tracking-[0.04em] text-[var(--tinta-3)]">Tugas pengawasan</p>
                  <p className="m-0 mono text-[1.87rem] leading-[1.1] font-semibold text-[var(--tinta)]">{totalTugas}</p>
                </div>
              </header>

              <PreviewTable label={`Penugasan pengawas ${ujian}`} columns={COLUMNS}>
                {groups.map((g) => (
                  <GroupRows key={g.key} group={g} xlsxUrl={`/ujian/rekap/xlsx?${query}&${new URLSearchParams({ pengawas: g.key })}`} />
                ))}
              </PreviewTable>
            </section>
          }
          panel={
            <DocFacts
              title="Isi file selain tabel"
              items={[
                { label: 'Judul', value: headerLines },
                { label: 'Penandatangan', value: [doc.jabatanPenandatangan, doc.namaPenandatangan] },
                { label: 'Kertas', value: 'A4 · Lanskap' },
              ]}
            />
          }
        />
      )}
    </div>
  )
}

function GroupRows({ group, xlsxUrl }: { group: PengawasGroup; xlsxUrl: string }) {
  return (
    <>
      <BandRow span={COLUMNS.length}>
        <span className="flex items-center gap-[0.8rem]">
          <span>{group.nama}</span>
          {group.kind === 'dosen' ? (
            <span className="text-[0.8rem] font-normal text-[var(--tinta-3)]">Dosen</span>
          ) : (
            // Free text has no identity behind it, so it is drawn as a dashed chip, as on the schedule.
            <span className="text-[0.8rem] font-normal px-[0.47rem] py-[0.07rem] rounded-full border border-dashed border-[var(--garis-kuat)] text-[var(--tinta-2)]">Non-dosen</span>
          )}
          <span className="ml-auto mono font-medium">{group.jumlah} tugas</span>
          <a href={xlsxUrl} aria-label={`Unduh Excel ${group.nama}`} className="text-[0.87rem] font-normal text-[var(--biru)] hover:underline">
            Unduh Excel
          </a>
        </span>
      </BandRow>
      {group.rows.map((r, i) => {
        const values = [r.hari, r.tanggal, r.jam, r.kode_mk, r.nama_mk, r.kelas, r.program, r.ruangan, r.keterangan]
        return (
          <tr key={i} className={`h-[2.6rem] border-t border-[var(--garis)] ${r.counted ? '' : 'text-[var(--tinta-3)]'}`}>
            {values.map((v, c) => (
              <td key={c} className={`${cell(c === 4 ? 'left' : COLUMNS[c].align)} ${MONO.has(c) ? 'mono' : ''} ${c === 0 ? 'font-medium' : ''}`}>
                {v || <span className="text-[var(--tinta-3)]">—</span>}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}
