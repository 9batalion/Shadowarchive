import {
  uuid
} from './ids.js';

function requireCrypto() {
  if (!crypto.subtle) throw new Error(
    'Ta funkcja wymaga HTTPS (np. GitHub Pages) lub localhost. Web Crypto nie jest dostępne w połączeniu HTTP.'
    );
}
const enc = new TextEncoder();
const dec = new TextDecoder();
export const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export async function sha256(bytes) {
  requireCrypto();
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}
export function base64(bytes) {
  const a = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768));
  return btoa(s);
}
export function unbase64(s) {
  const b = atob(s);
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
export async function derive(password, salt, iterations = 600000) {
  requireCrypto();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt,
    iterations,
    hash: 'SHA-256'
  }, key, {
    name: 'AES-GCM',
    length: 256
  }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(data, password) {
  if (password.length < 12) throw new Error('Hasło backupu musi mieć przynajmniej 12 znaków.');
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const cipher = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: enc.encode('ShadowArchive:1')
  }, key, enc.encode(JSON.stringify(data)));
  return {
    format: 'shadowarchive-encrypted',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: 600000,
    cipher: 'AES-256-GCM',
    salt: base64(salt),
    iv: base64(iv),
    data: base64(cipher)
  };
}
export async function decrypt(data, password) {
  if (data.format !== 'shadowarchive-encrypted' || data.version !== 1 || data.kdf !== 'PBKDF2-SHA256' ||
    data.iterations !== 600000 || data.cipher !== 'AES-256-GCM') throw new Error(
    'Nieobsługiwany format szyfrowania.');
  const salt = unbase64(data.salt),
    iv = unbase64(data.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Niepoprawne parametry szyfrowania');
  try {
    const key = await derive(password, salt);
    const bytes = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv,
      additionalData: enc.encode('ShadowArchive:1')
    }, key, unbase64(data.data));
    return JSON.parse(dec.decode(bytes));
  } catch {
    throw new Error('Nieprawidłowe hasło albo uszkodzony backup.');
  }
}
export async function fileRecord(file) {
  if (file.size > 150 * 1024 * 1024) throw new Error(
    'Limit pojedynczego pliku wynosi 150 MiB. Większe nagranie zapisz jako rekord z URL i przechowuj oryginał poza aplikacją.'
    );
  const bytes = await file.arrayBuffer();
  return {
    id: uuid(),
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    sha256: await sha256(bytes),
    addedAt: new Date().toISOString(),
    data: new Blob([bytes], {
      type: file.type || 'application/octet-stream'
    })
  };
}
export async function passwordProof(password, salt) {
  requireCrypto();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: 600000,
    hash: 'SHA-256'
  }, key, 256));
}
