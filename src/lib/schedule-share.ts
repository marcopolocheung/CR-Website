/**
 * Format and crypto for sharing one published week.
 *
 * The site is a static export on GitHub Pages: there is no server to hold a schedule and no
 * way to check a password. So the schedule travels inside the link itself, encrypted with a
 * code the manager chooses, and is decrypted in the reader's browser.
 *
 * Threat model, stated plainly: anyone holding both the link and the code can read the week.
 * The ciphertext is only as strong as the code, because an attacker with the link can guess
 * codes offline. `minimumCodeLength` and the iteration count below raise that cost; they do
 * not remove it. This is a shared secret, not an account.
 */

export const SHARE_VERSION = 1
export const minimumCodeLength = 6

const KEY_ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12

export type PublishedWeek = {
  version: number
  weekStart: string
  name: string
  /** Unique people referenced by index, so a name is stored once however many shifts it works. */
  people: string[]
  /** One entry per staffing slot in canonical order; -1 means nobody is assigned. */
  slotPeople: number[]
}

export class WrongCodeError extends Error {
  constructor() {
    super('That code did not open this schedule.')
    this.name = 'WrongCodeError'
  }
}

export class UnreadableShareError extends Error {
  constructor(message = 'This link is not a schedule link.') {
    super(message)
    this.name = 'UnreadableShareError'
  }
}

export function serializePublishedWeek(week: PublishedWeek) {
  return JSON.stringify({ v: week.version, w: week.weekStart, n: week.name, p: week.people, s: week.slotPeople })
}

export function deserializePublishedWeek(json: string): PublishedWeek {
  let raw: { v?: unknown; w?: unknown; n?: unknown; p?: unknown; s?: unknown }
  try {
    raw = JSON.parse(json)
  } catch {
    throw new UnreadableShareError()
  }

  if (
    raw.v !== SHARE_VERSION ||
    typeof raw.w !== 'string' ||
    typeof raw.n !== 'string' ||
    !Array.isArray(raw.p) ||
    !Array.isArray(raw.s) ||
    !raw.p.every((person): person is string => typeof person === 'string') ||
    !raw.s.every((index): index is number => Number.isInteger(index))
  ) {
    throw new UnreadableShareError()
  }

  return { version: raw.v, weekStart: raw.w, name: raw.n, people: raw.p, slotPeople: raw.s }
}

/** Copies into a fresh ArrayBuffer; subarray views of a larger buffer are not valid BufferSource. */
function ownBytes(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(view.byteLength))
  copy.set(view)
  return copy
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new UnreadableShareError()
  }
  return ownBytes(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}

async function deriveKey(code: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KEY_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptWeek(week: PublishedWeek, code: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(code, salt)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(serializePublishedWeek(week))),
  )

  const packed = new Uint8Array(salt.length + iv.length + ciphertext.length)
  packed.set(salt, 0)
  packed.set(iv, salt.length)
  packed.set(ciphertext, salt.length + iv.length)

  return toBase64Url(packed)
}

export async function decryptWeek(token: string, code: string): Promise<PublishedWeek> {
  const packed = fromBase64Url(token)
  if (packed.length <= SALT_BYTES + IV_BYTES) throw new UnreadableShareError()

  const key = await deriveKey(code, ownBytes(packed.slice(0, SALT_BYTES)))
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ownBytes(packed.slice(SALT_BYTES, SALT_BYTES + IV_BYTES)) },
      key,
      ownBytes(packed.slice(SALT_BYTES + IV_BYTES)),
    )
  } catch {
    // AES-GCM authentication failed, which for our purposes means the code was wrong.
    throw new WrongCodeError()
  }

  return deserializePublishedWeek(new TextDecoder().decode(plaintext))
}
