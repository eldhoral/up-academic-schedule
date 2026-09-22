import { toMinutes } from './clash'

export type TimedEvent = { jam_mulai: string; jam_selesai: string }
export type LaidOutEvent<T> = { event: T; col: number; cols: number }

/**
 * Classic calendar column-packing: greedily assigns each event in a
 * time-sorted list to the first free column, grouping mutually-overlapping
 * events into clusters so each cluster gets its own column count (Google
 * Calendar's day-view layout). Back-to-back events (end === start) share a
 * column, matching timeOverlapMinutes' "adjacent slots don't overlap" rule.
 */
export function layoutOverlapping<T extends TimedEvent>(events: T[]): LaidOutEvent<T>[] {
  const sorted = [...events].sort(
    (a, b) => toMinutes(a.jam_mulai) - toMinutes(b.jam_mulai) || toMinutes(a.jam_selesai) - toMinutes(b.jam_selesai)
  )

  const result: LaidOutEvent<T>[] = []
  let cluster: { event: T; col: number }[] = []
  let columnEnds: number[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    const cols = columnEnds.length
    for (const c of cluster) result.push({ event: c.event, col: c.col, cols })
    cluster = []
    columnEnds = []
    clusterEnd = -Infinity
  }

  for (const ev of sorted) {
    const start = toMinutes(ev.jam_mulai)
    const end = toMinutes(ev.jam_selesai)

    if (cluster.length > 0 && start >= clusterEnd) flushCluster()

    let col = columnEnds.findIndex((endTime) => endTime <= start)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[col] = end
    }
    cluster.push({ event: ev, col })
    clusterEnd = Math.max(clusterEnd, end)
  }
  flushCluster()

  return result
}
