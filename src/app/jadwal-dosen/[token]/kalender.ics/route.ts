import { toIcs } from '@/lib/ics'
import { buildEvents } from '../../events'
import { loadJadwalDosen } from '../../jadwal-data'

export async function GET(request: Request, ctx: RouteContext<'/jadwal-dosen/[token]/kalender.ics'>) {
  const { token } = await ctx.params
  try {
    const jadwal = await loadJadwalDosen(token)
    if (!jadwal) return new Response('Link jadwal tidak ditemukan.', { status: 404 })

    const body = toIcs(`Jadwal ${jadwal.nama}`, buildEvents(jadwal), new Date())
    const disposition = new URL(request.url).searchParams.has('unduh') ? 'attachment' : 'inline'
    const filename = `jadwal-${jadwal.kodeDosen.replace(/[^A-Za-z0-9_-]/g, '')}.ics`
    return new Response(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('jadwal-dosen feed:', err)
    return new Response('Jadwal tidak dapat dimuat. Coba lagi nanti.', { status: 500 })
  }
}
