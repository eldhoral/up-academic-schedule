import assert from 'node:assert/strict'
import { accessibleProdi, canAccessProdi, clampSemester, istilah, parseJenisKelas, parseProdi, prodiTag, semesterList, PRODI_CONFIG } from '../src/lib/prodi'
import { classifyRows } from '../src/lib/import/engine'

// --- parseProdi: only the two known values pass ----------------------------------------
assert.equal(parseProdi('s1'), 's1')
assert.equal(parseProdi('s2'), 's2')
assert.equal(parseProdi('S2'), null, 'route segments are lower case')
assert.equal(parseProdi('all'), null, 'all is an access level, not a prodi')
assert.equal(parseProdi(undefined), null)

// --- access ---------------------------------------------------------------------------
assert.equal(canAccessProdi('all', 's2'), true)
assert.equal(canAccessProdi('s1', 's1'), true)
assert.equal(canAccessProdi('s1', 's2'), false, 'an S1-only account cannot open S2')
assert.equal(canAccessProdi('s2', 's1'), false, 'an S2-only account cannot open S1')
assert.deepEqual(accessibleProdi('all'), ['s1', 's2'])
assert.deepEqual(accessibleProdi('s2'), ['s2'])

// --- shape per prodi --------------------------------------------------------------------
assert.deepEqual(semesterList('s1'), [1, 2, 3, 4, 5, 6, 7, 8])
assert.deepEqual(semesterList('s2'), [1, 2, 3, 4])
assert.equal(clampSemester('s2', '7'), 4, 'S2 has no semester 7')
assert.equal(clampSemester('s1', '7'), 7)
assert.equal(clampSemester('s1', 'abc'), 1)
assert.equal(clampSemester('s1', undefined), 1)
assert.equal(clampSemester('s1', '0'), 1)
assert.equal(parseJenisKelas('s1', 'regsus'), 'regsus')
assert.equal(parseJenisKelas('s2', 'regsus'), 'reguler', 'S2 has no Reguler Khusus')
assert.equal(parseJenisKelas('s1', 'nonsense'), 'reguler')
assert.equal(PRODI_CONFIG.s2.defense.prasidang, 'Seminar Proposal')
assert.equal(PRODI_CONFIG.s2.defense.sidang, 'Sidang Tesis')

// --- tag for the other prodi's side of a clash -------------------------------------------
assert.equal(prodiTag('s2', 's2'), '')
assert.equal(prodiTag('s2', 's1'), 'S1 · ')

// --- import on one prodi never takes over a key owned by the other ----------------------------
{
  const result = classifyRows({
    parsed: [{ k: 'A1' }, { k: 'B1' }, { k: 'C1' }],
    parseRow: (raw) => ({ key: String(raw.k), data: { k: String(raw.k) }, notes: [] }),
    existingByKey: new Map([['B1', { k: 'B1' }]]),
    equal: (a, b) => a.k === b.k,
    otherProdiKeys: new Set(['C1']),
  })
  assert.deepEqual(result.rows.map((r) => r.status), ['new', 'unchanged', 'rejected'])
  const rejected = result.rows[2]
  assert.ok(rejected.status === 'rejected' && rejected.reason.includes('prodi lain'), 'the reason says why')
}

// --- istilah: S1's grading words become S2's (kiprat 2026-11-27), S1 untouched ---------
assert.equal(istilah('s1', 'Berita Acara Prasidang Skripsi'), 'Berita Acara Prasidang Skripsi')
assert.equal(istilah('s2', 'Berita Acara Prasidang'), 'Berita Acara Seminar Proposal')
assert.equal(istilah('s2', 'FORM REVISI SIDANG SKRIPSI SARJANA (S1) PSIKOLOGI'), 'FORM REVISI SIDANG TESIS MAGISTER (S2) PSIKOLOGI')
assert.equal(istilah('s2', 'Hasil prasidang: skripsi tidak layak untuk dilanjutkan.'), 'Hasil seminar proposal: tesis tidak layak untuk dilanjutkan.')
assert.equal(istilah('s2', 'Revisi Sidang Skripsi — {nama}'), 'Revisi Sidang Tesis — {nama}')

console.log('prodi: all checks passed')
