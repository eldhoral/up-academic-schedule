'use client'

import { useRouter } from 'next/navigation'
import { DownloadButtons } from '@/components/DownloadButtons'
import { EmptySheet } from '@/components/EmptySheet'
import { Select } from '@/components/Select'
import { UjianCetakPreview } from './UjianCetakPreview'
import type { UjianSheet } from './ujian-cetak-data'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const ALL_DOSEN = '__all__'
const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

type Context = { academic_year_id: string; jenis_ujian: 'uts' | 'uas'; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number | 'all'; dosen: string } // dosen: kode_dosen, '' = semua

export function UjianCetakClient({
  academicYears,
  context,
  dosenOptions,
  sheets,
  doc,
}: {
  academicYears: AcademicYear[]
  context: Context
  dosenOptions: { value: string; label: string }[]
  sheets: UjianSheet[]
  doc: { namaPenandatangan: string; jabatanPenandatangan: string }
}) {
  const prodi = useProdi()
  const router = useRouter()
  const hasRows = sheets.some((s) => s.rows.length > 0)

  const queryOf = (c: Context) =>
    new URLSearchParams({ ay: c.academic_year_id, ujian: c.jenis_ujian, jenis: c.jenis_kelas, smt: String(c.semester_ke), ...(c.dosen ? { dosen: c.dosen } : {}) }).toString()
  const query = queryOf(context)

  function navigate(next: Partial<Context>) {
    router.push(`/${prodi}/ujian/cetak?${queryOf({ ...context, ...next })}`)
  }

  const program = context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'

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

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Program
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: v === 'all' ? 'all' : parseInt(v, 10) })}
          options={[{ value: 'all', label: 'Semua semester' }, ...SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))]}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-dosen">
          Dosen
        </label>
        <Select
          id="ctx-dosen"
          value={context.dosen || ALL_DOSEN}
          onValueChange={(v) => navigate({ dosen: v === ALL_DOSEN ? '' : v })}
          options={[{ value: ALL_DOSEN, label: 'Semua dosen' }, ...dosenOptions]}
          className={CONTROL}
        />

        <DownloadButtons
          enabled={hasRows}
          xlsxUrl={`/${prodi}/ujian/cetak/xlsx?${query}`}
          pdfUrl={`/${prodi}/ujian/cetak/pdf?${query}`}
          pdfFallbackName={`Jadwal ${context.jenis_ujian.toUpperCase()}.pdf`}
        />
      </div>

      {hasRows ? (
        <UjianCetakPreview sheets={sheets} doc={doc} prodi={prodi} />
      ) : (
        <EmptySheet
          title="Belum ada jadwal ujian untuk dicetak"
          detail={`${context.jenis_ujian.toUpperCase()} · ${context.semester_ke === 'all' ? 'Semua semester' : `Semester ${context.semester_ke}`} · ${program} · ${
            context.dosen ? `${dosenOptions.find((d) => d.value === context.dosen)?.label ?? context.dosen} · ` : ''
          }${
            academicYears.find((ay) => ay.id === context.academic_year_id)?.label ?? ''
          } belum memiliki jadwal ujian.`}
          // Ujian entry works one semester at a time; "Semua semester" opens its default.
          actionHref={`/${prodi}/ujian?${new URLSearchParams({
            ay: context.academic_year_id,
            ujian: context.jenis_ujian,
            jenis: context.jenis_kelas,
            ...(context.semester_ke === 'all' ? {} : { smt: String(context.semester_ke) }),
          })}`}
          actionLabel="Buka Jadwal Ujian"
        />
      )}
    </div>
  )
}
