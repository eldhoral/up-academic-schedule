import ExcelJS from 'exceljs'
import { tanggalPanjang } from '@/lib/hari'
import { addKop } from '@/lib/xlsx'

/** The revisi form handed to a student: who they are and each examiner's revisi. Grades are never part of it. */
export type FormRevisi = {
  jenis: 'prasidang' | 'sidang'
  npm: string
  nama: string
  judul: string
  tanggal: string
  /** Sidang: the yudisium once locked. Prasidang: the combined status. */
  hasil: string | null
  /** What the first column of each table holds: "Halaman" (sidang) or "Pertanyaan" (prasidang). */
  kolom: string
  /** One per examiner, in role order; empty rows = no revisi from that examiner. */
  bagian: { peranLabel: string; nama: string; rows: { rujukan: string; catatan: string }[] }[]
  /** Pengaturan S1 'kop_baris' lines (first = bold title), drawn with the UP logo like the Surat Penugasan; empty = no kop. */
  kop?: string[]
}

/** File name without extension, e.g. "Form Revisi Sidang 2021110099 Budi". */
export const namaFormRevisi = (d: FormRevisi) =>
  `Form Revisi ${d.jenis === 'sidang' ? 'Sidang' : 'Prasidang'} ${d.npm} ${d.nama}`.replace(/[^\w .-]/g, '')

/** One A4 portrait sheet. */
export async function buildFormRevisiXlsx(d: FormRevisi): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Form Revisi', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  ws.columns = [{ width: 6 }, { width: 28 }, { width: 70 }]
  const top = { vertical: 'top' as const, wrapText: true }
  const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }

  if (d.kop?.length) {
    addKop(wb, ws, d.kop)
    ws.addRow([])
  }
  const judul = ws.addRow([`FORM REVISI ${d.jenis === 'sidang' ? 'SIDANG' : 'PRASIDANG'} SKRIPSI SARJANA (S1) PSIKOLOGI`])
  ws.mergeCells(judul.number, 1, judul.number, 3)
  judul.font = { bold: true, size: 13 }
  judul.alignment = { horizontal: 'center' }
  ws.addRow([])
  const isian = (k: string, v: string) => {
    const r = ws.addRow([k, '', v])
    ws.mergeCells(r.number, 1, r.number, 2)
    r.getCell(1).value = `${k} :`
    r.getCell(3).alignment = top
  }
  isian('NPM', d.npm)
  isian('Nama Mahasiswa', d.nama)
  isian('Judul Skripsi', d.judul || '—')
  isian(`Tanggal ${d.jenis}`, tanggalPanjang(d.tanggal, false))
  if (d.hasil) isian(d.jenis === 'sidang' ? 'Yudisium' : 'Status Prasidang', d.hasil)

  if (d.bagian.every((b) => b.rows.length === 0)) {
    ws.addRow([])
    ws.addRow(['Tidak ada revisi.'])
  }
  for (const b of d.bagian) {
    if (b.rows.length === 0) continue
    ws.addRow([])
    ws.addRow([`${b.peranLabel}: ${b.nama}`]).font = { bold: true }
    const head = ws.addRow(['No', d.kolom, 'Catatan revisi'])
    head.font = { bold: true }
    const tabel = [head, ...b.rows.map((x, i) => ws.addRow([i + 1, x.rujukan || '-', x.catatan]))]
    for (const r of tabel) for (let c = 1; c <= 3; c++) { r.getCell(c).border = border; r.getCell(c).alignment = top }
  }

  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
