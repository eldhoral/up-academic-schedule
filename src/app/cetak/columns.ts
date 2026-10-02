// Single source of truth for the 8-column layout, shared by the Excel (exceljs)
// and the on-screen preview so both stay in sync with the reference sheet.

export type ColumnAlign = 'center' | 'left'

export const COLUMN_LABELS = ['KODE MK', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'NAMA DOSEN', 'RUANGAN LURING', 'BOR ZOOM']

// Excel character-width units, matching the reference workbook's column widths.
export const COLUMN_WIDTHS = [12, 34, 6, 10, 16, 28, 14, 16]

// KODE MK, SKS, HARI, JAM, RUANGAN LURING, and BOR ZOOM are short/uniform
// values -> centered; MATA KULIAH and NAMA DOSEN are free text -> left.
export const COLUMN_ALIGN: ColumnAlign[] = ['center', 'left', 'center', 'center', 'center', 'left', 'center', 'center']

// The signature block starts after this many columns (Excel merges from column E, index 4, onward).
export const SIGNATURE_START_COLUMN = 4
