import type { HitunganPrasidang, HariKelas, TitikNilai } from '@/app/beranda-data'
import { formatNilai } from '@/lib/penilaian/nilai'
import { STATUS_LABEL } from '@/lib/penilaian/prasidang'
import type { Prodi } from '@/lib/prodi'

const Kosong = () => <p className="m-0 py-[2rem] text-center text-[0.87rem] text-[var(--tinta-3)]">Belum ada data.</p>

const WARNA_PRODI: Record<Prodi, string> = { s1: 'var(--aksen-2)', s2: 'var(--aksen)' }

/** Grouped bars, one series per accessible prodi; the aria-label carries the counts for screen readers. */
export function BatangHari({ data, prodiList }: { data: HariKelas[]; prodiList: Prodi[] }) {
  if (!data.length || !prodiList.length || data.every((d) => prodiList.every((p) => !d.jumlah[p]))) return <Kosong />
  const maks = Math.max(1, ...data.flatMap((d) => prodiList.map((p) => d.jumlah[p] ?? 0)))
  const tinggi = 110
  const lebar = data.length * 42
  const keterangan = data.map((d) => `${d.label}: ${prodiList.map((p) => `${p.toUpperCase()} ${d.jumlah[p] ?? 0}`).join(', ')}`).join('; ')

  return (
    <div>
      <svg role="img" aria-label={keterangan} viewBox={`0 0 ${lebar} ${tinggi + 24}`} className="h-[11rem] w-full">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={0} x2={lebar} y1={tinggi - f * tinggi} y2={tinggi - f * tinggi} stroke="var(--garis)" strokeWidth={1} />
        ))}
        {data.map((d, i) => (
          <g key={d.hari}>
            {prodiList.map((p, j) => {
              const n = d.jumlah[p] ?? 0
              const h = n ? Math.max(3, (n / maks) * tinggi) : 0
              return <rect key={p} x={i * 42 + 6 + j * 16} y={tinggi - h} width={13} height={h} rx={2} fill={WARNA_PRODI[p]} />
            })}
            <text x={i * 42 + 17} y={tinggi + 16} textAnchor="middle" fontSize={10} fill="var(--tinta-3)">
              {d.label.slice(0, 3)}
            </text>
          </g>
        ))}
      </svg>
      <ul className="m-0 mt-[0.4rem] flex flex-wrap justify-center gap-x-[1rem] gap-y-[0.3rem] p-0 list-none text-[0.78rem] text-[var(--tinta-2)]">
        {prodiList.map((p) => (
          <li key={p} className="flex items-center gap-[0.35rem]">
            <span aria-hidden="true" className="inline-block h-[0.6rem] w-[0.6rem] rounded-[2px]" style={{ background: WARNA_PRODI[p] }} />
            {p.toUpperCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** '2025/2026 Gasal' -> '25/26 G', to fit under a narrow chart point. */
const singkat = (label: string) => label.replace(/20(\d{2})\/20(\d{2})\s+(Gasal|Genap)/, (_, a, b, s: string) => `${a}/${b} ${s === 'Gasal' ? 'G' : 'S'}`)

export function GarisNilai({ data }: { data: TitikNilai[] }) {
  if (!data.length) return <Kosong />
  const lebar = Math.max(260, data.length * 82)
  const tinggi = 110
  const pad = 22
  const angka = data.map((d) => d.rata)
  const bawah = Math.max(0, Math.min(...angka) - 5)
  const atas = Math.min(100, Math.max(...angka) + 5)
  const rentang = Math.max(1, atas - bawah)
  const x = (i: number) => pad + i * ((lebar - 2 * pad) / Math.max(1, data.length - 1))
  const y = (v: number) => tinggi - pad - ((v - bawah) / rentang) * (tinggi - 2 * pad)
  const terakhir = data[data.length - 1]

  return (
    <svg
      role="img"
      aria-label={`Rata-rata nilai sidang: ${data.map((d) => `${d.label} ${formatNilai(d.rata)}`).join(', ')}`}
      viewBox={`0 0 ${lebar} ${tinggi + 24}`}
      className="h-[11rem] w-full"
    >
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={0} x2={lebar} y1={tinggi - f * tinggi} y2={tinggi - f * tinggi} stroke="var(--garis)" strokeWidth={1} />
      ))}
      <polyline
        points={data.map((d, i) => `${x(i)},${y(d.rata)}`).join(' ')}
        fill="none"
        stroke="var(--aksen)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((d, i) => (
        <circle key={d.id} cx={x(i)} cy={y(d.rata)} r={3.5} fill="var(--aksen)" />
      ))}
      <text x={x(data.length - 1)} y={y(terakhir.rata) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--aksen)">
        {formatNilai(terakhir.rata)}
      </text>
      {data.map((d, i) => (
        <text key={`${d.id}-label`} x={x(i)} y={tinggi + 16} textAnchor="middle" fontSize={9} fill="var(--tinta-3)">
          {singkat(d.label)}
        </text>
      ))}
    </svg>
  )
}

type KunciHasil = keyof HitunganPrasidang
const BAGIAN: { kunci: KunciHasil; pendek: string; warna: string }[] = [
  { kunci: 'layak', pendek: 'Layak', warna: 'var(--aksen-2)' },
  { kunci: 'layak_revisi', pendek: 'Layak revisi', warna: 'var(--kuning)' },
  { kunci: 'tidak_layak', pendek: 'Tidak layak', warna: 'var(--merah)' },
  { kunci: 'belum_lengkap', pendek: 'Belum lengkap', warna: 'var(--tinta-3)' },
]

export function DonatPrasidang({ data }: { data: HitunganPrasidang }) {
  const total = BAGIAN.reduce((sum, b) => sum + data[b.kunci], 0)
  if (total === 0) return <Kosong />
  const jari = 42
  const keliling = 2 * Math.PI * jari
  const aktif = BAGIAN.filter((b) => data[b.kunci] > 0)
  const panjang = aktif.map((b) => (data[b.kunci] / total) * keliling)
  const busur = aktif.map((b, i) => (
    <circle
      key={b.kunci}
      cx={60}
      cy={60}
      r={jari}
      fill="none"
      stroke={b.warna}
      strokeWidth={14}
      strokeDasharray={`${panjang[i]} ${keliling - panjang[i]}`}
      strokeDashoffset={-panjang.slice(0, i).reduce((a, n) => a + n, 0)}
      transform="rotate(-90 60 60)"
    />
  ))

  return (
    <div className="flex flex-col items-center gap-[0.8rem] sm:flex-row sm:justify-center">
      <svg
        role="img"
        aria-label={`Hasil prasidang: ${BAGIAN.map((b) => `${b.pendek} ${data[b.kunci]}`).join(', ')}`}
        viewBox="0 0 120 120"
        className="h-[9rem] w-[9rem] shrink-0"
      >
        <circle cx={60} cy={60} r={jari} fill="none" stroke="var(--garis)" strokeWidth={14} />
        {busur}
        <text x={60} y={60} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={700} fill="var(--tinta)">
          {total}
        </text>
      </svg>
      <ul className="m-0 flex flex-wrap justify-center gap-x-[0.9rem] gap-y-[0.3rem] p-0 list-none text-[0.8rem] text-[var(--tinta-2)]">
        {BAGIAN.map((b) => (
          <li key={b.kunci} title={STATUS_LABEL[b.kunci]} className="flex items-center gap-[0.35rem]">
            <span aria-hidden="true" className="inline-block h-[0.6rem] w-[0.6rem] rounded-[2px]" style={{ background: b.warna }} />
            {b.pendek} <span className="mono font-semibold">{data[b.kunci]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
