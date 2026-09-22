import assert from 'node:assert/strict'
import { layoutOverlapping } from '../src/lib/calendar-layout'

type Ev = { id: string; jam_mulai: string; jam_selesai: string }

// No overlap at all: every event gets its own column of 1.
{
  const events: Ev[] = [
    { id: 'a', jam_mulai: '07:00', jam_selesai: '08:00' },
    { id: 'b', jam_mulai: '09:00', jam_selesai: '10:00' },
  ]
  const laid = layoutOverlapping(events)
  assert.equal(laid.length, 2)
  for (const l of laid) assert.equal(l.cols, 1)
}

// Two fully overlapping events split into 2 columns.
{
  const events: Ev[] = [
    { id: 'a', jam_mulai: '13:00', jam_selesai: '14:40' },
    { id: 'b', jam_mulai: '13:00', jam_selesai: '14:40' },
  ]
  const laid = layoutOverlapping(events)
  assert.equal(laid.length, 2)
  assert.deepEqual(laid.map((l) => l.cols), [2, 2])
  assert.deepEqual(new Set(laid.map((l) => l.col)), new Set([0, 1]))
}

// Back-to-back (end === next start) events share a column, not split.
{
  const events: Ev[] = [
    { id: 'a', jam_mulai: '07:30', jam_selesai: '09:10' },
    { id: 'b', jam_mulai: '09:10', jam_selesai: '11:00' },
  ]
  const laid = layoutOverlapping(events)
  assert.deepEqual(laid.map((l) => l.cols), [1, 1])
  assert.deepEqual(laid.map((l) => l.col), [0, 0])
}

// Three-way overlap needs 3 columns; a later, non-overlapping event starts a fresh cluster of 1.
{
  const events: Ev[] = [
    { id: 'a', jam_mulai: '10:00', jam_selesai: '11:00' },
    { id: 'b', jam_mulai: '10:00', jam_selesai: '11:00' },
    { id: 'c', jam_mulai: '10:30', jam_selesai: '11:30' },
    { id: 'd', jam_mulai: '14:00', jam_selesai: '15:00' },
  ]
  const laid = layoutOverlapping(events)
  const byId = new Map(laid.map((l) => [(l.event as Ev).id, l]))
  assert.equal(byId.get('a')!.cols, 3)
  assert.equal(byId.get('b')!.cols, 3)
  assert.equal(byId.get('c')!.cols, 3)
  assert.equal(byId.get('d')!.cols, 1)
  assert.equal(byId.get('d')!.col, 0)
}

// A cluster releases a column once its occupant ends, so a later, still-overlapping
// event can reuse it — column count reflects true concurrency, not raw event count.
{
  const events: Ev[] = [
    { id: 'a', jam_mulai: '10:00', jam_selesai: '10:30' },
    { id: 'b', jam_mulai: '10:00', jam_selesai: '11:00' },
    { id: 'c', jam_mulai: '10:30', jam_selesai: '11:00' },
  ]
  const laid = layoutOverlapping(events)
  const byId = new Map(laid.map((l) => [(l.event as Ev).id, l]))
  assert.equal(byId.get('a')!.cols, 2)
  assert.equal(byId.get('c')!.col, byId.get('a')!.col, 'c reuses a\'s freed column')
}

console.log('calendar-layout: all checks passed')
