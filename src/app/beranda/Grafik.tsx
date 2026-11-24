import type { HitunganPrasidang, HariKelas, TitikNilai } from '@/app/beranda-data'
import type { Prodi } from '@/lib/prodi'

/*
 * Drawn as in Final-Beranda.dc.html: a 520×200 viewBox, four grid lines (y 20/70/120/170),
 * 11px axis text. Sizes outside the SVG are the mockup's px / 15 (the app's default root size).
 */

const Kosong = () => <p className="m-0 py-[2rem] text-center text-[0.933rem] text-[var(--tinta-3)]">Belum ada data.</p>

export const WARNA_PRODI: Record<Prodi, string> = { s1: 'var(--aksen-2)', s2: 'var(--aksen)' }

const GARIS_Y = [20, 70, 120, 170]
const TEKS = { fontSize: 11, fill: 'var(--tinta-3)' }

/** S1/S2 swatches for the "Kelas per Hari" header. */
export function LegendaProdi({ prodiList }: { prodiList: Prodi[] }) {
  return (
    <div className="flex gap-[0.933rem] text-[0.8rem] text-[var(--tinta-2)]">
      {prodiList.map((p) => (
        <span key={p} className="flex items-center gap-[0.4rem]">
          <span aria-hidden="true" className="size-[10px] rounded-[3px]" style={{ background: WARNA_PRODI[p] }} />
          {p.toUpperCase()}
        </span>
      ))}
    </div>
  )
}

/** Three equal steps from 0 that cover the largest count (15 / 10 / 5 / 0 in the mockup). */
const skala = (maks: number) => Math.max(1, Math.ceil(maks / 3))

/** Grouped bars, one series per accessible prodi; the aria-label carries the counts for screen readers. */
export function BatangHari({ data, prodiList }: { data: HariKelas[]; prodiList: Prodi[] }) {
  if (!data.length || !prodiList.length || data.every((d) => prodiList.every((p) => !d.jumlah[p]))) return <Kosong />
  const langkah = skala(Math.max(...data.flatMap((d) => prodiList.map((p) => d.jumlah[p] ?? 0))))
  const atas = langkah * 3
  const slot = 480 / data.length
  const keterangan = `Kelas per hari. ${prodiList
    .map((p) => `${p.toUpperCase()}: ${data.map((d) => `${d.label} ${d.jumlah[p] ?? 0}`).join(', ')}`)
    .join('. ')}.`

  return (
    <svg role="img" aria-label={keterangan} viewBox="0 0 520 200" className="mt-[0.667rem] h-auto w-full">
      <g stroke="var(--grafik-kisi)">
        {GARIS_Y.map((y) => (
          <line key={y} x1={26} x2={520} y1={y} y2={y} />
        ))}
      </g>
      <g {...TEKS}>
        {GARIS_Y.map((y, i) => (
          <text key={y} x={0} y={y + 4}>
            {langkah * (3 - i)}
          </text>
        ))}
      </g>
      {data.map((d, i) => {
        const tengah = 32 + slot * (i + 0.5)
        const kiri = tengah - (prodiList.length * 18 + (prodiList.length - 1) * 4) / 2
        return (
          <g key={d.hari}>
            {prodiList.map((p, j) => {
              const h = ((d.jumlah[p] ?? 0) / atas) * 150
              return h > 0 && <rect key={p} x={kiri + j * 22} y={170 - h} width={18} height={h} rx={4} fill={WARNA_PRODI[p]} />
            })}
            <text x={tengah} y={190} textAnchor="middle" {...TEKS}>
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** '2025/2026 Gasal' -> '25/26 Gasal', as under the mockup's points. */
const singkat = (label: string) => label.replace(/20(\d{2})\/20(\d{2})/, '$1/$2')
const satuDesimal = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function GarisNilai({ data }: { data: TitikNilai[] }) {
  if (!data.length) return <Kosong />
  const angka = data.map((d) => d.rata)
  // Steps of 5 (85 / 80 / 75 / 70 in the mockup), widened when the spread needs it.
  const bawah = Math.floor((Math.min(...angka) - 1) / 5) * 5
  const langkah = Math.max(5, Math.ceil((Math.max(...angka) - bawah) / 3 / 5) * 5)
  const y = (v: number) => 170 - ((v - bawah) / (langkah * 3)) * 150
  const x = (i: number) => (data.length === 1 ? 265 : 70 + (i * 390) / (data.length - 1))
  const titik = data.map((d, i) => `${x(i)} ${y(d.rata)}`)
  const akhir = data.length - 1

  return (
    <svg
      role="img"
      aria-label={`Rata-rata nilai sidang S1. ${data.map((d) => `${d.label} ${satuDesimal(d.rata)}`).join('; ')}.`}
      viewBox="0 0 520 200"
      className="mt-[0.667rem] h-auto w-full"
    >
      <g stroke="var(--grafik-kisi)">
        {GARIS_Y.map((g) => (
          <line key={g} x1={30} x2={520} y1={g} y2={g} />
        ))}
      </g>
      <g {...TEKS}>
        {GARIS_Y.map((g, i) => (
          <text key={g} x={0} y={g + 4}>
            {bawah + langkah * (3 - i)}
          </text>
        ))}
      </g>
      <path d={`M${titik.join(' L')} L${x(akhir)} 170 L${x(0)} 170 Z`} fill="var(--aksen-2)" opacity={0.12} />
      <path d={`M${titik.join(' L')}`} fill="none" stroke="var(--aksen-2)" strokeWidth={2.5} />
      <g fill="#fff" stroke="var(--aksen-2)" strokeWidth={2}>
        {data.map((d, i) => (
          <circle key={d.id} cx={x(i)} cy={y(d.rata)} r={i === akhir ? 5 : 4} />
        ))}
      </g>
      <rect x={x(akhir) - 24} y={y(data[akhir].rata) - 31} width={48} height={20} rx={5} fill="var(--tinta)" />
      <text x={x(akhir)} y={y(data[akhir].rata) - 17} textAnchor="middle" fontSize={11} fill="#fff">
        {satuDesimal(data[akhir].rata)}
      </text>
      <g {...TEKS} textAnchor="middle">
        {data.map((d, i) => (
          <text key={d.id} x={x(i)} y={190}>
            {singkat(d.label)}
          </text>
        ))}
      </g>
    </svg>
  )
}

type KunciHasil = keyof HitunganPrasidang
const BAGIAN: { kunci: KunciHasil; pendek: string; panjang: string; warna: string }[] = [
  { kunci: 'layak', pendek: 'Layak', panjang: 'layak', warna: 'var(--aksen-2)' },
  { kunci: 'layak_revisi', pendek: 'Layak revisi', panjang: 'layak dengan revisi', warna: 'var(--aksen)' },
  { kunci: 'tidak_layak', pendek: 'Tidak layak', panjang: 'tidak layak', warna: 'var(--grafik-oranye)' },
  { kunci: 'belum_lengkap', pendek: 'Belum lengkap', panjang: 'belum lengkap', warna: 'var(--grafik-abu)' },
]

export function DonatPrasidang({ data }: { data: HitunganPrasidang }) {
  const total = BAGIAN.reduce((sum, b) => sum + data[b.kunci], 0)
  if (total === 0) return <Kosong />
  const keliling = 2 * Math.PI * 62
  const panjang = BAGIAN.map((b) => (data[b.kunci] / total) * keliling)
  return (
    <>
      <svg
        role="img"
        aria-label={`Hasil prasidang S1: ${BAGIAN.map((b) => `${b.panjang} ${data[b.kunci]}`).join(', ')}, total ${total}`}
        viewBox="0 0 160 160"
        className="size-[150px]"
      >
        <circle cx={80} cy={80} r={62} fill="none" stroke="var(--grafik-jalur)" strokeWidth={16} />
        {BAGIAN.map(
          (b, i) =>
            panjang[i] > 0 && (
              <circle
              key={b.kunci}
              cx={80}
              cy={80}
              r={62}
              fill="none"
              stroke={b.warna}
              strokeWidth={16}
                strokeDasharray={`${panjang[i]} ${keliling}`}
                strokeDashoffset={-panjang.slice(0, i).reduce((a, n) => a + n, 0)}
                transform="rotate(-90 80 80)"
              />
            ),
        )}
        <text x={80} y={82} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--tinta)">
          {total}
        </text>
        <text x={80} y={101} textAnchor="middle" fontSize={11} fill="var(--tinta-3)">
          prasidang
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-[0.8rem] gap-y-[0.4rem] self-stretch text-[0.867rem]">
        {BAGIAN.map((b) => (
          <span key={b.kunci} className="flex items-center gap-[0.4rem]">
            <span aria-hidden="true" className="size-[9px] shrink-0 rounded-full" style={{ background: b.warna }} />
            {b.pendek} · {data[b.kunci]}
          </span>
        ))}
      </div>
    </>
  )
}
