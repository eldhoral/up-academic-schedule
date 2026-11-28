import ExcelJS from 'exceljs'
import { tanggalPanjang } from '@/lib/hari'
import { addKop, BORDER_ALL, istilahLembar } from '@/lib/xlsx'
import { PERAN_LABEL, PERAN_SIDANG, type Peran } from './akses'
import type { BarisNilai } from './aturan'
import type { Penilaian, Sidang } from './data'
import { baris, hasilAkhir, nilaiBimbingan, type HasilAkhir, type SkorAspek } from './nilai'

/** The Nilai Bimbingan page as a file (kiprat 2026-11-27): each pembimbing's aspek, then Hasil Akhir, like the old HOME tab. */
export type HasilBimbingan = {
  prodi: string
  npm: string
  nama: string
  judul: string
  tanggal: string
  pembimbing: { label: string; nama: string; aspek: SkorAspek[] | null; nilai: number | null }[]
  bimbingan: number | null
  hasil: HasilAkhir
  ipkAwal: number | null
  tabel: BarisNilai[]
  kop?: string[]
}

/** Null until the sidang is locked with readable frozen rules (the page shows no Hasil Akhir before that either). */
export function hasilBimbinganDari(data: Penilaian, sidang: Sidang, kop: string[]): HasilBimbingan | null {
  const beku = sidang.hasil?.aturan
  if (!sidang.hasil || !beku) return null
  const { defense } = data
  const peran: Peran[] = defense.tanpa_pembimbing_2 ? ['pembimbing_1'] : ['pembimbing_1', 'pembimbing_2']
  const bimbingan = nilaiBimbingan(data.nilai.pembimbing_1?.nilai ?? null, data.nilai.pembimbing_2?.nilai ?? null, defense.tanpa_pembimbing_2)
  return {
    prodi: defense.prodi, npm: defense.npm, nama: defense.nama_mahasiswa, judul: defense.judul_skripsi, tanggal: defense.tanggal,
    pembimbing: peran.map((p) => ({ label: PERAN_LABEL[p], nama: data.dosen[p], aspek: data.nilai[p]?.aspek ?? null, nilai: data.nilai[p]?.nilai ?? null })),
    bimbingan,
    hasil: hasilAkhir({
      sidang: PERAN_SIDANG.map((p) => sidang.nilai[p]?.nilai ?? null), locked: { lulus: sidang.hasil.yudisium_lulus, aturan: beku },
      bimbingan, sks: sidang.student.sks, bobot: sidang.student.bobot, tepatWaktu: sidang.student.tepatWaktu,
    }),
    ipkAwal: data.ipk,
    tabel: beku.tabelNilai,
    kop,
  }
}

/** File name without extension, e.g. "Nilai Bimbingan 2021110099 Budi". */
export const namaHasilBimbingan = (d: HasilBimbingan) => `Nilai Bimbingan ${d.npm} ${d.nama}`.replace(/[^\w .-]/g, '')

/** One A4 portrait sheet; numbers stay numbers (0.00). Written in S1's words, reworded for S2 at the end. */
export async function buildHasilBimbinganXlsx(d: HasilBimbingan): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Nilai Bimbingan', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  ws.columns = [{ width: 40 }, { width: 3 }, { width: 34 }, { width: 12 }, { width: 12 }]
  const huruf = (n: number | null) => (n === null ? '' : baris(n, d.tabel).huruf)
  const tebal = (r: ExcelJS.Row) => { r.font = { bold: true } }
  const kosong = () => ws.addRow([])
  const isian = (label: string, value: string) => ws.addRow([label, ':', value])
  const tabel = (rows: ExcelJS.Row[]) => {
    for (const r of rows) {
      for (let c = 1; c <= 5; c++) r.getCell(c).border = BORDER_ALL
      ws.mergeCells(r.number, 1, r.number, 3)
      for (const c of [4, 5]) r.getCell(c).alignment = { horizontal: 'center' }
    }
  }

  if (d.kop?.length) {
    addKop(wb, ws, d.kop, 5)
    kosong()
  }
  const judul = ws.addRow(['FORM PENILAIAN PEMBIMBINGAN SKRIPSI SARJANA (S1) PSIKOLOGI'])
  ws.mergeCells(judul.number, 1, judul.number, 5)
  judul.font = { bold: true, size: 13 }
  judul.alignment = { horizontal: 'center' }
  kosong()
  isian('NPM', d.npm)
  isian('Nama Mahasiswa', d.nama)
  isian('Judul Skripsi', d.judul || '—').getCell(3).alignment = { wrapText: true, vertical: 'top' }
  isian('Tanggal Sidang', tanggalPanjang(d.tanggal, false))
  kosong()

  for (const p of d.pembimbing) {
    tebal(ws.addRow([`${p.label}: ${p.nama}`]))
    if (!p.aspek) {
      ws.addRow(['Belum dinilai.'])
      kosong()
      continue
    }
    const head = ws.addRow(['ASPEK', '', '', 'BOBOT', 'NILAI'])
    tebal(head)
    const rows = [head, ...p.aspek.map((a) => ws.addRow([a.label, '', '', `${a.bobot}%`, a.skor]))]
    const total = ws.addRow([`NILAI (${huruf(p.nilai)})`, '', '', '', p.nilai])
    tebal(total)
    total.getCell(5).numFmt = '0.00'
    tabel([...rows, total])
    kosong()
  }

  tebal(ws.addRow(['HASIL AKHIR']))
  const h = d.hasil
  const head = ws.addRow(['', '', '', 'NILAI', 'HURUF'])
  tebal(head)
  const nilaiAkhir = h.status === 'lengkap' ? h.nilaiAkhir : null
  const rows = [
    head,
    ws.addRow(['Nilai Bimbingan', '', '', d.bimbingan ?? '', huruf(d.bimbingan)]),
    ws.addRow(['Nilai Sidang', '', '', h.nilaiSidang ?? '', huruf(h.nilaiSidang)]),
    ws.addRow(['Nilai Akhir', '', '', nilaiAkhir ?? '', huruf(nilaiAkhir)]),
  ]
  tebal(rows[3])
  for (const r of rows.slice(1)) r.getCell(4).numFmt = '0.00'
  tabel(rows)
  kosong()
  if (h.status === 'lengkap') {
    const ipk = [ws.addRow(['IPK Awal', '', '', '', d.ipkAwal ?? h.ipkSebelum]), ws.addRow(['IPK Akhir', '', '', '', h.ipkSetelah])]
    tebal(ipk[1])
    for (const r of ipk) r.getCell(5).numFmt = '0.00'
    if (h.predikat) ipk.push(ws.addRow(['Predikat', '', '', '', h.predikat]))
    tabel(ipk)
  } else {
    ws.addRow([`${h.alasan}.`])
  }

  istilahLembar(ws, d.prodi)
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
