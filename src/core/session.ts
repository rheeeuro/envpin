import { decodeBase64, encodeBase64, verifyKey } from './crypto';
import type { VaultMetadata } from '../types';
export const SESSION = 'vault:session';
export const fingerprint = (meta: VaultMetadata) => JSON.stringify(meta);
export async function saveSession(key: CryptoKey, meta: VaultMetadata) {
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.set({ [SESSION]: { fingerprint: fingerprint(meta), key: encodeBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key))) } });
}
export async function clearSession() { await chrome.storage.session.remove(SESSION); }
export async function restoreSession(meta: VaultMetadata): Promise<CryptoKey | null> {
  const saved = (await chrome.storage.session.get(SESSION))[SESSION];
  if (!saved) return null;
  try {
    if (saved.fingerprint !== fingerprint(meta)) throw new Error();
    const key = await crypto.subtle.importKey('raw', decodeBase64(saved.key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    await verifyKey(key, meta);
    return key;
  } catch { await clearSession(); return null; }
}
