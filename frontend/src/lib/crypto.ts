import type { EncryptedSecret } from '../types'

/** UUID v4 generator — works in HTTP (non-secure) contexts where crypto.randomUUID() is unavailable */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback: crypto.getRandomValues IS available in non-secure contexts
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const iterations = 120_000

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...array))
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(secret: string, password: string): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(secret))
  return { version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2', salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) }
}

export async function decryptSecret(secret: EncryptedSecret, password: string): Promise<string> {
  const key = await deriveKey(password, fromBase64(secret.salt))
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(secret.iv) }, key, fromBase64(secret.ciphertext))
  return decoder.decode(plaintext)
}
