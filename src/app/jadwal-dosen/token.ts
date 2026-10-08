import { randomBytes } from 'node:crypto'

/** 32 random bytes as base64url: 43 characters, unguessable. Server only. */
export const newJadwalToken = () => randomBytes(32).toString('base64url')

/** Shape check before any query: anything else is simply "not found". */
export const isJadwalToken = (s: string) => /^[A-Za-z0-9_-]{43}$/.test(s)
