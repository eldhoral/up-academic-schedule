import assert from 'node:assert/strict'
import { loadCurrentUser, canWrite, canManage, isDosen, isPenguji, ROLES, ROLE_LABEL } from '../src/lib/roles'
import { generatePassword } from '../src/lib/password'

type Profile = { role: string; prodi_access: string | null; kode_dosen?: string | null; berlaku_sampai?: string | null }

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
    assert.deepEqual(await loadCurrentUser(client), { id: 'u1', email: 'a@b.id', role: 'SCHEDULER', prodiAccess: 's2', kodeDosen: null, berlakuSampai: null })
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

  // EKSTERNAL: a day account. Valid through berlaku_sampai (Jakarta), never writes or manages, expired = signed out.
  {
    const besok = new Date(Date.now() + 36 * 3600e3).toISOString().slice(0, 10)
    const lalu = new Date(Date.now() - 48 * 3600e3).toISOString().slice(0, 10)
    const aktif = await loadCurrentUser(fakeClient({ sub: 'u6', email: 'x@y.id' }, { role: 'EKSTERNAL', prodi_access: 'all', kode_dosen: 'EXT01', berlaku_sampai: besok }).client)
    assert.deepEqual(aktif, { id: 'u6', email: 'x@y.id', role: 'EKSTERNAL', prodiAccess: 's1', kodeDosen: 'EXT01', berlakuSampai: besok })
    assert.equal(await loadCurrentUser(fakeClient({ sub: 'u7' }, { role: 'EKSTERNAL', prodi_access: 'all', kode_dosen: 'EXT01', berlaku_sampai: lalu }).client), null)
    assert.equal(canWrite('EKSTERNAL'), false)
    assert.equal(canManage('EKSTERNAL'), false)
    assert.equal(isDosen('EKSTERNAL'), false)
    assert.equal(isPenguji('EKSTERNAL'), true)
    assert.equal(isPenguji('DOSEN'), true)
    assert.equal(isPenguji('VIEWER'), false)
    assert.equal(isPenguji(null), false)
    assert.ok(ROLES.includes('EKSTERNAL'))
    assert.equal(ROLE_LABEL.EKSTERNAL, 'Penguji Eksternal')
    // A DOSEN never carries a berlaku_sampai.
    assert.equal((await loadCurrentUser(fakeClient({ sub: 'u8' }, { role: 'DOSEN', prodi_access: 's1', kode_dosen: 'D1', berlaku_sampai: besok }).client))?.berlakuSampai, null)
  }

  // Admin-generated password: 12 characters, never the look-alikes 0 O 1 l I, and not the same twice.
  {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      assert.match(p, /^[A-HJ-NP-Za-km-z2-9]{12}$/)
      seen.add(p)
    }
    assert.equal(seen.size, 200)
  }

  console.log('roles: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
