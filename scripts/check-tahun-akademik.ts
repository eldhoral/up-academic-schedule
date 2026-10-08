import assert from 'node:assert/strict'
import { saveAcademicYear } from '../src/app/tahun-akademik/save-year'

/** Records each academic_years write as one line; the write numbered `failAt` (1-based) returns an error. */
function fakeClient(failAt?: number) {
  const calls: string[] = []
  const client = {
    from: (table: string) => {
      assert.equal(table, 'academic_years')
      let line = ''
      const query = {
        insert: (row: object) => ((line = `insert ${JSON.stringify(row)}`), query),
        update: (row: object) => ((line = `update ${JSON.stringify(row)}`), query),
        eq: (col: string, value: unknown) => ((line += ` ${col}=${value}`), query),
        neq: (col: string, value: unknown) => ((line += ` ${col}!=${value}`), query),
        then: (resolve: (r: { error: { message: string } | null }) => unknown) => {
          calls.push(line)
          return resolve({ error: calls.length === failAt ? { message: 'boom' } : null })
        },
      }
      return query
    },
  }
  return { client: client as never, calls }
}

const fields = { label: '2026/2027 Genap', mulai_kuliah: '2027-02-15', selesai_kuliah: null }
const fieldsJson = JSON.stringify(fields).slice(1, -1)
const INSERT = `insert {"id":"20262",${fieldsJson},"is_active":false}`
const ACTIVATE = 'update {"is_active":true} id=20262'
const DEACTIVATE_OTHERS = 'update {"is_active":false} is_active=true id!=20262'

async function main() {
  // --- a new active term: saved inactive, then activated, then the others turned off -----------
  {
    const { client, calls } = fakeClient()
    assert.equal(await saveAcademicYear(client, { id: '20262', isNew: true, fields, isActive: true }), null)
    assert.deepEqual(calls, [INSERT, ACTIVATE, DEACTIVATE_OTHERS])
  }

  // --- a failed save never turns the current active term off -------------------------------------
  {
    const { client, calls } = fakeClient(1)
    const result = await saveAcademicYear(client, { id: '20262', isNew: true, fields, isActive: true })
    assert.equal(result?.step, 'save')
    assert.deepEqual(calls, [INSERT], 'nothing after the failed insert')
  }

  // --- activation failed: the old active term is still active ---------------------------------------
  {
    const { client, calls } = fakeClient(2)
    assert.equal((await saveAcademicYear(client, { id: '20262', isNew: true, fields, isActive: true }))?.step, 'activate')
    assert.deepEqual(calls, [INSERT, ACTIVATE], 'others are not turned off when activation failed')
  }

  // --- turning the others off failed: two active for now, never none ------------------------------
  {
    const { client } = fakeClient(3)
    assert.equal((await saveAcademicYear(client, { id: '20262', isNew: true, fields, isActive: true }))?.step, 'deactivate')
  }

  // --- a new inactive term touches nothing else ------------------------------------------------------
  {
    const { client, calls } = fakeClient()
    await saveAcademicYear(client, { id: '20262', isNew: true, fields, isActive: false })
    assert.deepEqual(calls, [INSERT])
  }

  // --- editing: fields first, then the same activate / turn-others-off order -----------------------
  {
    const { client, calls } = fakeClient()
    await saveAcademicYear(client, { id: '20262', isNew: false, fields, isActive: true })
    assert.deepEqual(calls, [`update {${fieldsJson}} id=20262`, ACTIVATE, DEACTIVATE_OTHERS])
  }

  // --- editing without Aktif: only this term, switched off if it was on ----------------------------
  {
    const { client, calls } = fakeClient()
    await saveAcademicYear(client, { id: '20262', isNew: false, fields, isActive: false })
    assert.deepEqual(calls, [`update {${fieldsJson},"is_active":false} id=20262`])
  }

  console.log('tahun akademik: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
