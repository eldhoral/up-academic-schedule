import assert from 'node:assert/strict'
import { loadSettings } from '../src/lib/settings'

type Row = { key: string; value: string; type: string; prodi: string }
const rows: Row[] = [
  { key: 'jam_mulai_reguler', value: '07:30', type: 'time', prodi: 's1' },
  { key: 'nama_dekan', value: 'Dr. X', type: 'text', prodi: 'all' },
  { key: 'gambar_tanda_tangan', value: 'data:image/png;base64,AAAA', type: 'image', prodi: 's1' },
  { key: 'jam_mulai_reguler', value: '18:00', type: 'time', prodi: 's2' },
]

/** Just enough of the supabase query builder to run the filters loadSettings applies. */
function fakeClient() {
  return {
    from: (table: string) => {
      assert.equal(table, 'settings')
      let result = rows
      const query = {
        select: () => query,
        in: (col: keyof Row, values: string[]) => ((result = result.filter((r) => values.includes(r[col]))), query),
        neq: (col: keyof Row, value: string) => ((result = result.filter((r) => r[col] !== value)), query),
        then: (resolve: (v: { data: Row[] }) => unknown) => resolve({ data: result }),
      }
      return query
    },
  }
}

async function main() {
  // Most pages never print a signature, so they do not pull the base64 images.
  assert.deepEqual(await loadSettings(fakeClient() as never, 's1', false), { jam_mulai_reguler: '07:30', nama_dekan: 'Dr. X' })

  // The cetak and rekap pages ask for them.
  assert.equal((await loadSettings(fakeClient() as never, 's1', true)).gambar_tanda_tangan, 'data:image/png;base64,AAAA')

  // A prodi sees its own rows plus the shared ones, never the other prodi's.
  assert.equal((await loadSettings(fakeClient() as never, 's2', false)).jam_mulai_reguler, '18:00')

  console.log('settings: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
