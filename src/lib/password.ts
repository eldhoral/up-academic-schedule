import { randomInt } from 'node:crypto'

// No 0 O 1 l I: the password is read off a screen and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export const GENERATED_PASSWORD_LENGTH = 12

/** rand(n) returns 0..n-1; injectable so checks can seed it. */
export function generatePassword(length = GENERATED_PASSWORD_LENGTH, rand: (n: number) => number = randomInt): string {
  return Array.from({ length }, () => ALPHABET[rand(ALPHABET.length)]).join('')
}
