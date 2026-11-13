import { randomInt } from 'node:crypto'

// No 0 O 1 l I: the password is read off a screen and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

export const GENERATED_PASSWORD_LENGTH = 12

export function generatePassword(): string {
  return Array.from({ length: GENERATED_PASSWORD_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}
