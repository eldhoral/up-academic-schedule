import assert from 'node:assert/strict'
import { loadCurrentUser, canWrite, canManage, isDosen } from '../src/lib/roles'

type Profile = { role: string; prodi_access: string | null; kode_dosen?: string | null }

/** A client whose token holds `claims` and whose profiles table holds `profile`; counts the calls. */
function fakeClient(claims: { sub: string; email?: string } | null, profile: Profile | null) {
  const calls = { getClaims: 0, getUser: 0, profiles: 0 }
  const client = {
    auth: {
      getClaims: async () => (calls.getClaims++, { data: claims ? { claims } : null, error: null }),
      getUser: async () => (calls.getUser++, { data: { user: claims ? { id: claims.sub, email: claims.email } : null }, error: null }),
    },
    from: (table: string) => {
      assert.equal(table, 'profiles')
      calls.profiles++
      const query = { select: () => query, eq: () => query, single: async () => ({ data: profile }) }
      return query
    },
  }
  return { client: client as never, calls }
}

async function main() {
  // The token's claims identify the user; no extra round trip to the Auth server.
  {
    const { client, calls } = fakeClient({ sub: 'u1', email: 'a@b.id' }, { role: 'SCHEDULER', prodi_access: 's2', kode_dosen: null })
    assert.deepEqual(await loadCurrentUser(client), { id: 'u1', email: 'a@b.id', role: 'SCHEDULER', prodiAccess: 's2', kodeDosen: null })
    assert.deepEqual(calls, { getClaims: 1, getUser: 0, profiles: 1 })
  }

  // Signed out: no profile query at all.
  {
    const { client, calls } = fakeClient(null, null)
    assert.equal(await loadCurrentUser(client), null)
    assert.equal(calls.profiles, 0)
  }

  // SUPERADMIN always gets every prodi; a missing profile is no user.
  {
    const { client } = fakeClient({ sub: 'u2' }, { role: 'SUPERADMIN', prodi_access: 's1' })
    assert.equal((await loadCurrentUser(client))?.prodiAccess, 'all')
    assert.equal(await loadCurrentUser(fakeClient({ sub: 'u3' }, null).client), null)
  }

  // DOSEN: linked to one lecturer, S1 only, never writes or manages; staff never carry a kode_dosen.
  {
    const dosen = await loadCurrentUser(fakeClient({ sub: 'u4' }, { role: 'DOSEN', prodi_access: 'all', kode_dosen: 'DSN01' }).client)
    assert.equal(dosen?.kodeDosen, 'DSN01')
    assert.equal(dosen?.prodiAccess, 's1')
    assert.equal((await loadCurrentUser(fakeClient({ sub: 'u5' }, { role: 'VIEWER', prodi_access: 's1', kode_dosen: 'DSN01' }).client))?.kodeDosen, null)
    assert.equal(canWrite('DOSEN'), false)
    assert.equal(canManage('DOSEN'), false)
    assert.equal(isDosen('DOSEN'), true)
    assert.equal(isDosen('VIEWER'), false)
    assert.equal(isDosen(null), false)
  }

  console.log('roles: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
