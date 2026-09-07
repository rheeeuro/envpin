import type { EncryptedPayload, StoredEncryptedSecret, VaultMetadata } from '../types';
import { validateMetadata, validatePayload } from './validation';
export const ITERATIONS = 600_000;
const VERIFICATION = 'API_KEY_VAULT_VERIFICATION_V1';
export function encodeBase64(bytes: Uint8Array): string { return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')); }
export function decodeBase64(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function generateSalt(): Uint8Array<ArrayBuffer> { return crypto.getRandomValues(new Uint8Array(16)); }
export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS): Promise<CryptoKey> {
  if (salt.length !== 16 || !Number.isInteger(iterations) || iterations < ITERATIONS || iterations > 2_000_000) throw new Error('Unsupported vault parameters.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
export async function encrypt<T>(value: T, key: CryptoKey, context: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: encodeBase64(iv), ciphertext: encodeBase64(new Uint8Array(ciphertext)) };
}
export async function decrypt<T>(payload: EncryptedPayload, key: CryptoKey, context: string): Promise<T> {
  validatePayload(payload);
  const iv = decodeBase64(payload.iv);
  if (iv.length !== 12) throw new Error('Invalid encrypted data.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) }, key, decodeBase64(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
export function vaultIdentity(meta: VaultMetadata): string {
  return meta.version === 2 ? meta.id : 'legacy-' + Array.from(decodeBase64(meta.salt), b => b.toString(16).padStart(2, '0')).join('');
}
const verificationContext = (meta: VaultMetadata) => meta.version === 1 ? 'envpin:vault:1' : `envpin:vault:2:${meta.id}`;
export async function makeMetadata(key: CryptoKey, salt: Uint8Array): Promise<VaultMetadata> {
  const id = crypto.randomUUID();
  return { version: 2, id, salt: encodeBase64(salt), iterations: ITERATIONS, verification: await encrypt(VERIFICATION, key, `envpin:vault:2:${id}`), createdAt: Date.now() };
}
export async function verifyKey(key: CryptoKey, meta: VaultMetadata): Promise<void> {
  validateMetadata(meta);
  if (await decrypt(meta.verification, key, verificationContext(meta)) !== VERIFICATION) throw new Error('Unable to unlock vault.');
}
export const secretContext = (id: string, updatedAt: number) => `envpin:secret:1:${id}:${updatedAt}`;
export function recordContext(record: Pick<StoredEncryptedSecret, 'version' | 'id' | 'updatedAt'> & { vaultId?: string; kind?: string }): string {
  return record.version === 1 ? secretContext(record.id, record.updatedAt) : `envpin:secret:2:${record.vaultId}:${record.kind}:${record.id}:${record.updatedAt}`;
}
