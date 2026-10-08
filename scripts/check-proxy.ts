import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { updateSession } from '../src/lib/supabase/proxy'

async function main() {
  // An auth check that throws (bad config, Supabase SDK error) must not let the request through.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'not a url'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
  const res = await updateSession(new NextRequest('http://localhost/s1/kuliah'))
  assert.equal(res.status, 307, 'redirected, not passed through')
  const to = new URL(res.headers.get('location')!)
  assert.equal(to.pathname, '/masuk')
  assert.equal(to.searchParams.get('redirectTo'), '/s1/kuliah')

  // The login page itself stays reachable, or a broken check would loop.
  const masuk = await updateSession(new NextRequest('http://localhost/masuk'))
  assert.equal(masuk.headers.get('location'), null, '/masuk is not redirected')

  // The lecturer link and its feed are public: no login, no redirect...
  for (const path of ['/jadwal-dosen/abc', '/jadwal-dosen/abc/kalender.ics']) {
    const r = await updateSession(new NextRequest(`http://localhost${path}`))
    assert.equal(r.headers.get('location'), null, `${path} passes through`)
  }
  // ...but only under that exact prefix.
  for (const path of ['/jadwal-dosenx', '/jadwal-dosen']) {
    const r = await updateSession(new NextRequest(`http://localhost${path}`))
    assert.equal(new URL(r.headers.get('location')!).pathname, '/masuk', `${path} still needs login`)
  }

  console.log('proxy: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
