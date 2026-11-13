import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { tolakDosen, updateSession } from '../src/lib/supabase/proxy'

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
  // ...and the password page is for a signed-in user (the reset link signs them in first).
  for (const path of ['/jadwal-dosenx', '/jadwal-dosen', '/atur-kata-sandi']) {
    const r = await updateSession(new NextRequest(`http://localhost${path}`))
    assert.equal(new URL(r.headers.get('location')!).pathname, '/masuk', `${path} still needs login`)
  }

  // A DOSEN is kept to its grading pages: pages redirect to Penilaian Saya, exports and staff POSTs get 403.
  const req = (path: string, method = 'GET') => new NextRequest(`http://localhost${path}`, { method })
  for (const path of ['/', '/s1/kuliah', '/pengguna', '/api/export/courses', '/s1/sidang/cetak/xlsx', '/s1/kuliah/cetak/pdf', '/log-aktivitas', '/penilaianx', '/nilai-bimbingan', '/nilai-bimbingan/a/b']) {
    const r = tolakDosen(req(path), 'DOSEN')
    assert.equal(r?.status, 307, `${path} blocked for DOSEN`)
    assert.equal(new URL(r!.headers.get('location')!).pathname, '/penilaian')
  }
  assert.equal(tolakDosen(req('/s1/kuliah', 'POST'), 'DOSEN')?.status, 403, 'a staff action POST is refused')
  for (const path of ['/penilaian', '/nilai-bimbingan/0b4f6d1e-1111-4222-8333-944455556666', '/atur-kata-sandi']) {
    assert.equal(tolakDosen(req(path), 'DOSEN'), null, `${path} open to DOSEN`)
    assert.equal(tolakDosen(req(path, 'POST'), 'DOSEN'), null, `${path} actions open to DOSEN`)
  }
  for (const role of ['SUPERADMIN', 'SCHEDULER', 'VIEWER', undefined]) {
    assert.equal(tolakDosen(req('/s1/kuliah'), role), null, `${role} passes`)
  }

  console.log('proxy: all checks passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
