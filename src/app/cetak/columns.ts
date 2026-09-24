// Single source of truth for the 8-column layout, shared by the Excel (exceljs)
// and PDF (react-pdf) renderers so both stay in sync with the reference sheet.

export type ColumnAlign = 'center' | 'left'

export const COLUMN_LABELS = ['KODE MK', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'NAMA DOSEN', 'RUANGAN LURING', 'BOR ZOOM']

// Excel character-width units, matching the reference workbook's column widths.
export const COLUMN_WIDTHS = [12, 34, 6, 10, 16, 28, 14, 16]

// PDF column widths as percentages, tuned separately from COLUMN_WIDTHS: Excel's
// character-width units and Helvetica's point-based text metrics don't scale the
// same way, and reusing COLUMN_WIDTHS verbatim made JAM wrap onto two lines.
export const PDF_COLUMN_WIDTH_PERCENT = [9, 23, 5, 9, 16, 16, 11, 11]

// KODE MK, SKS, HARI, JAM, RUANGAN LURING, and BOR ZOOM are short/uniform
// values -> centered; MATA KULIAH and NAMA DOSEN are free text -> left.
export const COLUMN_ALIGN: ColumnAlign[] = ['center', 'left', 'center', 'center', 'center', 'left', 'center', 'center']

// The signature block starts after this many columns (Excel merges from column E, index 4, onward).
export const SIGNATURE_START_COLUMN = 4

/** Where the signature block should start in the PDF, as a percentage from the left. */
export const PDF_SIGNATURE_LEFT_PERCENT = PDF_COLUMN_WIDTH_PERCENT.slice(0, SIGNATURE_START_COLUMN).reduce((sum, w) => sum + w, 0)
