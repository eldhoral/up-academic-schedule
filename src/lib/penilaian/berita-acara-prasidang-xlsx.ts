import ExcelJS from 'exceljs'
import { tanggalPanjang } from '@/lib/hari'
import type { BeritaAcara } from './data'
import { HASIL_LABEL, PERAN_PRASIDANG, PERAN_PRASIDANG_LABEL, STATUS_LABEL } from './prasidang'

/** Both berita acara of one S1 prasidang, as the staff page shows them: A4 portrait, one sheet. */
export async function buildBeritaAcaraPrasidangXlsx(d: BeritaAcara): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Berita Acara Prasidang', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  ws.columns = [{ width: 24 }, { width: 3 }, { width: 70 }]
  const wrap = (r: ExcelJS.Row, c = 3) => { r.getCell(c).alignment = { wrapText: true, vertical: 'top' } }
  const bold = (r: ExcelJS.Row) => { r.font = { bold: true } }
  const isian = (label: string, value: string) => wrap(ws.addRow([label, ':', value]))

  const judul = ws.addRow(['BERITA ACARA PRASIDANG SKRIPSI SARJANA (S1) PSIKOLOGI'])
  ws.mergeCells(judul.number, 1, judul.number, 3)
  judul.font = { bold: true, size: 13 }
  judul.alignment = { horizontal: 'center' }
  ws.addRow([])
  isian('NPM', d.defense.npm)
  isian('Nama Mahasiswa', d.defense.nama_mahasiswa)
  isian('Judul Skripsi', d.defense.judul_skripsi || '—')
  isian('Hari/Tanggal Prasidang', tanggalPanjang(d.defense.tanggal, false))
  isian('Status Prasidang', STATUS_LABEL[d.status])
  if (d.keputusan) isian('Keputusan Super Admin', `${HASIL_LABEL[d.keputusan.hasil]} — ${d.keputusan.alasan}`)

  for (const peran of PERAN_PRASIDANG) {
    ws.addRow([])
    bold(ws.addRow([`${PERAN_PRASIDANG_LABEL[peran]}: ${d.dosen[peran]}`]))
    const row = d.isian[peran]
    if (!row) {
      ws.addRow(['Belum diisi.'])
      continue
    }
    const kirim = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(row.submitted_at))
    ws.addRow([`Dikirim ${kirim}`])
    row.jawaban.forEach((j, i) => {
      bold(ws.addRow([`${i + 1}. ${j.teks}`]))
      const jawab = j.jenis === 'uraian' ? j.catatan : [j.ya ? 'Ya' : 'Tidak', j.catatan].filter(Boolean).join('\n')
      wrap(ws.addRow(['', '', jawab || '—']))
    })
    bold(ws.addRow(['Hasil prasidang', ':', HASIL_LABEL[row.hasil]]))
  }

  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
