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

  console.log('proxy: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
