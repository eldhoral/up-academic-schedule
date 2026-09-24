// Column layout for the Surat Penugasan's teaching-load table, matching
// docs/Draft Surat Penugasan Pengampu Dosen MK Gasal 26-27.docx.

export type ColumnAlign = 'center' | 'left'

export const REKAP_COLUMN_LABELS = ['NO.', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'KELAS', 'RUANG']

// Excel character-width units.
export const REKAP_COLUMN_WIDTHS = [5, 34, 6, 10, 16, 8, 10]

// PDF widths as percentages (react-pdf uses points, Excel uses character
// units -- they don't scale the same way, so this is tuned separately).
export const REKAP_PDF_COLUMN_WIDTH_PERCENT = [7, 34, 7, 11, 18, 10, 13]

// NO, SKS, HARI, JAM, KELAS, RUANG are short/uniform values -> centered;
// MATA KULIAH is free text -> left.
export const REKAP_COLUMN_ALIGN: ColumnAlign[] = ['center', 'left', 'center', 'center', 'center', 'center', 'center']

// The signature block starts after this many columns.
export const REKAP_SIGNATURE_START_COLUMN = 4

export const REKAP_PDF_SIGNATURE_LEFT_PERCENT = REKAP_PDF_COLUMN_WIDTH_PERCENT.slice(0, REKAP_SIGNATURE_START_COLUMN).reduce(
  (sum, w) => sum + w,
  0,
)
