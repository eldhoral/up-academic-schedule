import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { groupSchedulesByKelas } from './schedule-rows'
import { COLUMN_ALIGN, COLUMN_LABELS, PDF_COLUMN_WIDTH_PERCENT, PDF_SIGNATURE_LEFT_PERCENT } from './columns'
import type { ScheduleRow } from '../penjadwalan-types'

// The reference document never hyphenates; react-pdf's default hyphenation
// callback would otherwise break long words like "RUANGAN" as "RUAN-GAN".
Font.registerHyphenationCallback((word) => [word])

const BORDER = '#000'

const styles = StyleSheet.create({
  page: {
    // Matches the reference workbook's print margins (Excel's Page Setup, in inches).
    paddingTop: '0.6in',
    paddingBottom: '0.6in',
    paddingLeft: '0.4in',
    paddingRight: '0.4in',
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
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  headerCell: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCellText: {
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
  cell: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 10,
  },
  kelasBanner: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kelasBannerText: {
    fontWeight: 'bold',
    fontSize: 10,
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
    marginLeft: `${PDF_SIGNATURE_LEFT_PERCENT}%`,
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
  const kelasGroups = groupSchedulesByKelas(schedules)

  const size = (['A4', 'Letter', 'Legal'] as const).includes(ukuranKertas as 'A4' | 'Letter' | 'Legal')
    ? (ukuranKertas.toUpperCase() as 'A4' | 'LETTER' | 'LEGAL')
    : 'A4'
  const orientation = orientasi === 'landscape' ? 'landscape' : 'portrait'
  const headerLabels = [...COLUMN_LABELS.slice(0, -1), `BOR ZOOM \n${zoomId}`]

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
            <View style={styles.row} fixed>
              {headerLabels.map((label, i) => (
                <View key={label} style={[styles.headerCell, { width: `${PDF_COLUMN_WIDTH_PERCENT[i]}%` }]}>
                  <Text style={styles.headerCellText}>{label}</Text>
                </View>
              ))}
            </View>

            {kelasGroups.map(([kelas, rows]) => (
              <View key={kelas}>
                <View style={styles.row} wrap={false}>
                  <View style={[styles.kelasBanner, { width: '100%' }]}>
                    <Text style={styles.kelasBannerText}>KELAS {kelas}</Text>
                  </View>
                </View>
                {rows.map((r) => (
                  <View key={r.id} style={styles.row} wrap={false}>
                    {[r.kode_mk, r.mata_kuliah, r.sks, r.hari, r.jam, r.dosen, r.ruangan, r.zoom].map((value, i) => (
                      <View
                        key={i}
                        style={[
                          styles.cell,
                          { width: `${PDF_COLUMN_WIDTH_PERCENT[i]}%`, alignItems: COLUMN_ALIGN[i] === 'center' ? 'center' : 'flex-start' },
                        ]}
                      >
                        <Text style={styles.cellText}>{value}</Text>
                      </View>
                    ))}
                  </View>
                ))}
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
