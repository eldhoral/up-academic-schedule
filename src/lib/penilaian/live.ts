/**
 * Live grading page (LiveSidang). Every (re)subscribe refreshes the page, so grades sent while the
 * connection was down still show up; an error, timeout or close shows the reload note.
 */
export function aksiKanal(status: string): { putus: boolean; segarkan: boolean } {
  if (status === 'SUBSCRIBED') return { putus: false, segarkan: true }
  return { putus: status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED', segarkan: false }
}

/** A fresh topic per mount: realtime-js hands back an existing channel with the same topic, even one still leaving. */
export const topikKanal = (defenseId: string): string => `sidang-${defenseId}-${crypto.randomUUID()}`
