/**
 * Crypto utilities — with HTTP fallback.
 * In HTTPS contexts, uses Web Crypto API (AES-GCM).
 * In HTTP contexts, falls back to base64 obfuscation.
 */

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 3);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Check if secure crypto is available
const hasCrypto = typeof crypto !== 'undefined' && !!crypto.subtle;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

// ─── AES-GCM path (HTTPS) ───────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle!.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle!.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

const CRYPTO_SALT_KEY = 'ai-image-station:crypto-salt';
const ENCRYPTION_PASSWORD = 'ai-image-station-local-key';

function getOrCreateSalt(): Uint8Array {
  const existing = localStorage.getItem(CRYPTO_SALT_KEY);
  if (existing) {
    return new Uint8Array(base64ToArrayBuffer(existing));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(CRYPTO_SALT_KEY, arrayBufferToBase64(salt.buffer));
  return salt;
}

async function encryptAES(plaintext: string): Promise<EncryptedData> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(ENCRYPTION_PASSWORD, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle!.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

async function decryptAES(encrypted: EncryptedData): Promise<string> {
  const salt = getOrCreateSalt();
  const key = await deriveKey(ENCRYPTION_PASSWORD, salt);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ciphertext = new Uint8Array(base64ToArrayBuffer(encrypted.ciphertext));
  const plaintext = await crypto.subtle!.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Base64 fallback (HTTP) ──────────────────────────────────────

function encryptBase64(plaintext: string): EncryptedData {
  const encoded = btoa(unescape(encodeURIComponent(plaintext)));
  return { iv: 'http-fallback', ciphertext: encoded };
}

function decryptBase64(encrypted: EncryptedData): string {
  return decodeURIComponent(escape(atob(encrypted.ciphertext)));
}

// ─── Public API ──────────────────────────────────────────────────

export async function encryptSecret(plaintext: string): Promise<EncryptedData> {
  if (hasCrypto) {
    return encryptAES(plaintext);
  }
  return encryptBase64(plaintext);
}

export async function decryptSecret(encrypted: EncryptedData): Promise<string> {
  // New HTTP-fallback data → base64 decode
  if (encrypted.iv === 'http-fallback') {
    return decryptBase64(encrypted);
  }
  // Old AES data → need Web Crypto
  if (hasCrypto) {
    return decryptAES(encrypted);
  }
  // Old AES data but no crypto.subtle (HTTP) → can't decrypt
  throw new Error('加密数据需要 HTTPS 环境解密。请重新输入 API Key。');
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '●'.repeat(key.length);
  return '●'.repeat(key.length - 4) + key.slice(-4);
}
