import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import type { ScheduleRow } from '../penjadwalan-types'

// The reference document never hyphenates; react-pdf's default hyphenation
// callback would otherwise break long words like "RUANGAN" as "RUAN-GAN".
Font.registerHyphenationCallback((word) => [word])

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)

const BORDER = '#000'

type Column = { key: string; label: string; w: string; center?: boolean }

const COLUMNS: Column[] = [
  { key: 'kode_mk', label: 'KODE MK', w: '9%' },
  { key: 'mata_kuliah', label: 'MATA KULIAH', w: '23%' },
  { key: 'sks', label: 'SKS', w: '5%', center: true },
  { key: 'hari', label: 'HARI', w: '9%' },
  { key: 'jam', label: 'JAM', w: '16%' },
  { key: 'nama_dosen', label: 'NAMA DOSEN', w: '16%' },
  { key: 'ruangan', label: 'RUANGAN LURING', w: '11%' },
  { key: 'zoom', label: 'BOR ZOOM', w: '11%' },
]

const styles = StyleSheet.create({
  page: {
    paddingTop: '1.5cm',
    paddingBottom: '1.5cm',
    paddingLeft: '1cm',
    paddingRight: '1cm',
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  headerLine: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 12,
  },
  empty: {
    textAlign: 'center',
    fontSize: 11,
    marginVertical: 24,
  },
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  headerCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
    paddingVertical: 3,
    justifyContent: 'center',
  },
  headerCellText: {
    fontWeight: 'bold',
    fontSize: 10,
  },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 10,
  },
  kelasBanner: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keterangan: {
    marginBottom: 12,
  },
  keteranganTitle: {
    fontWeight: 'bold',
    fontSize: 10,
  },
  keteranganLine: {
    fontSize: 10,
  },
  signature: {
    marginTop: 30,
    marginLeft: '55%',
    alignItems: 'center',
  },
  signatureLine: {
    fontSize: 10,
    marginTop: 4,
  },
  signatureImage: {
    height: '3.2cm',
    marginTop: 4,
  },
  signatureSpacer: {
    height: '2cm',
    marginTop: 4,
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 'bold',
    textDecoration: 'underline',
    marginTop: 4,
  },
})

export function CetakDocument({
  schedules,
  headerLines,
  zoomId,
  zoomPasscode,
  keteranganLines,
  namaPenandatangan,
  jabatanPenandatangan,
  gambarTandaTangan,
  ukuranKertas,
  orientasi,
}: {
  schedules: ScheduleRow[]
  headerLines: string[]
  zoomId: string
  zoomPasscode: string
  keteranganLines: string[]
  namaPenandatangan: string
  jabatanPenandatangan: string
  gambarTandaTangan: string
  ukuranKertas: string
  orientasi: string
}) {
  const byKelas = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    const list = byKelas.get(s.kelas) ?? []
    list.push(s)
    byKelas.set(s.kelas, list)
  }
  const kelasGroups = Array.from(byKelas.entries()).sort(([a], [b]) => a.localeCompare(b))

  const size = (['A4', 'Letter', 'Legal'] as const).includes(ukuranKertas as 'A4' | 'Letter' | 'Legal')
    ? (ukuranKertas.toUpperCase() as 'A4' | 'LETTER' | 'LEGAL')
    : 'A4'
  const orientation = orientasi === 'landscape' ? 'landscape' : 'portrait'

  return (
    <Document>
      <Page size={size} orientation={orientation} style={styles.page} wrap>
        <View style={styles.header}>
          {headerLines.map((line, i) => (
            <Text key={i} style={styles.headerLine}>
              {line}
            </Text>
          ))}
          <Text style={styles.headerLine}>
            ID ZOOM : {zoomId}
            {zoomPasscode ? `     PASSCODE : ${zoomPasscode}` : ''}
          </Text>
        </View>

        {kelasGroups.length === 0 && <Text style={styles.empty}>Tidak ada data jadwal untuk pilihan ini.</Text>}

        {kelasGroups.length > 0 && (
          <View style={styles.table}>
            <View style={styles.row} wrap={false}>
              {COLUMNS.map((col) => (
                <View key={col.key} style={[styles.headerCell, { width: col.w, alignItems: col.center ? 'center' : 'flex-start' }]}>
                  <Text style={styles.headerCellText}>{col.key === 'zoom' ? `BOR ZOOM ${zoomId}` : col.label}</Text>
                </View>
              ))}
            </View>

            {kelasGroups.map(([kelas, rows]) => (
              <View key={kelas}>
                <View style={styles.row} wrap={false}>
                  <View style={[styles.kelasBanner, { width: '100%' }]}>
                    <Text style={styles.headerCellText}>KELAS {kelas}</Text>
                  </View>
                </View>
                {rows
                  .sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
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
                      <View key={r.id} style={styles.row} wrap={false}>
                        <View style={[styles.cell, { width: COLUMNS[0].w }]}>
                          <Text style={styles.cellText}>{r.kode_mk}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[1].w }]}>
                          <Text style={styles.cellText}>
                            {r.courses?.nama_mk ?? r.kode_mk}
                            {suffix}
                          </Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[2].w, alignItems: 'center' }]}>
                          <Text style={styles.cellText}>{r.courses?.sks ?? ''}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[3].w }]}>
                          <Text style={styles.cellText}>{r.hari}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[4].w }]}>
                          <Text style={styles.cellText}>
                            {r.jam_mulai.slice(0, 5)} - {r.jam_selesai.slice(0, 5)}
                          </Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[5].w }]}>
                          <Text style={styles.cellText}>{dosen}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[6].w }]}>
                          <Text style={styles.cellText}>{r.rooms?.nama ?? ''}</Text>
                        </View>
                        <View style={[styles.cell, { width: COLUMNS[7].w }]}>
                          <Text style={styles.cellText}>{r.zoom_id || ''}</Text>
                        </View>
                      </View>
                    )
                  })}
              </View>
            ))}
          </View>
        )}

        <View style={styles.keterangan}>
          <Text style={styles.keteranganTitle}>KETERANGAN:</Text>
          {keteranganLines.map((line, i) => (
            <Text key={i} style={styles.keteranganLine}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.signature} wrap={false}>
          <Text style={styles.signatureLine}>{jabatanPenandatangan}</Text>
          {gambarTandaTangan ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={gambarTandaTangan} style={styles.signatureImage} />
          ) : (
            <View style={styles.signatureSpacer} />
          )}
          <Text style={styles.signatureName}>{namaPenandatangan}</Text>
        </View>
      </Page>
    </Document>
  )
}
