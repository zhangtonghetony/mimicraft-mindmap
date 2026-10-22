import { MAX_FILE_BYTES, parseDocument, serializeDocument, type MapDocument } from './model';

const aad = new TextEncoder().encode('mimicraft-encrypted:1:PBKDF2-SHA256:AES-256-GCM:250000');
function base64(data: Uint8Array) { let out = ''; for (let i = 0; i < data.length; i += 8192) out += String.fromCharCode(...data.subarray(i, i + 8192)); return btoa(out); }
function decode(text: unknown, size?: number): Uint8Array<ArrayBuffer> {
  if (typeof text !== 'string' || !/^[a-zA-Z0-9+/]*={0,2}$/.test(text)) throw new Error();
  const bytes = Uint8Array.from(atob(text), character => character.charCodeAt(0)); if (size && bytes.length !== size) throw new Error(); return bytes;
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage[]) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 250000, salt }, material, { name: 'AES-GCM', length: 256 }, false, usage);
}
export function isEncrypted(text: string): boolean { try { return JSON.parse(text)?.format === 'mimicraft-encrypted'; } catch { return false; } }
export async function encryptWorkbook(doc: MapDocument, password: string): Promise<string> {
  if (password.length < 8 || password.length > 1000) throw new Error('密码长度需为 8～1000 个字符');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(serializeDocument(doc));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, await key(password, salt, ['encrypt']), plaintext);
  return JSON.stringify({ format: 'mimicraft-encrypted', version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: 250000, salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext)) });
}
export async function decryptWorkbook(text: string, password: string, asCopy = true): Promise<MapDocument> {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES * 1.4 + 2000) throw new Error('加密文件过大');
  let plaintext: ArrayBuffer;
  try {
    const data = JSON.parse(text); if (data.format !== 'mimicraft-encrypted' || data.version !== 1 || data.algorithm !== 'AES-256-GCM' || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== 250000 || Object.keys(data).some(field => !['format', 'version', 'algorithm', 'kdf', 'iterations', 'salt', 'iv', 'ciphertext'].includes(field))) throw new Error();
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(data.iv, 12), additionalData: aad }, await key(password, decode(data.salt, 16), ['decrypt']), decode(data.ciphertext));
  } catch { throw new Error('密码错误或文件损坏，当前导图未改变'); }
  return parseDocument(new TextDecoder().decode(plaintext), asCopy);
}
