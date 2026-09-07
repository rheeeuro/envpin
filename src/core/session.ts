import { stableJson } from './serialization';
import { decodeBase64, encodeBase64, verifyKey } from './crypto';
import type { VaultMetadata } from '../types';
import { exclusive } from './coordination';
import { CancelledError } from './errors';
import { base64Bytes } from './validation';
export const SESSION = 'vault:session';
export const EPOCH = 'vault:session-epoch';
export const fingerprint = (meta: VaultMetadata) => stableJson(meta);
export async function sessionEpoch(): Promise<string | null> {
  const value = (await chrome.storage.session.get(EPOCH))[EPOCH];
  return typeof value === 'string' ? value : null;
}
export async function saveSession(key: CryptoKey, meta: VaultMetadata, epoch: string | null, current: () => boolean): Promise<string> {
  return exclusive('session', async () => {
    if (!current() || await sessionEpoch() !== epoch || !current()) throw new CancelledError();
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    const bytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const id = crypto.randomUUID();
    try {
      if (!current()) throw new CancelledError();
      await chrome.storage.session.set({ [SESSION]: { id, epoch, fingerprint: fingerprint(meta), key: encodeBase64(bytes) } });
      if (!current()) {
        await chrome.storage.session.remove(SESSION);
        throw new CancelledError();
      }
      return id;
    } finally { bytes.fill(0); }
  });
}
export async function clearSession() {
  await exclusive('session', async () => {
    // Invalidate first: even if remove fails, an old session cannot be restored.
    await chrome.storage.session.set({ [EPOCH]: crypto.randomUUID() });
    await chrome.storage.session.remove(SESSION);
  });
}
export async function discardSession(id: string) {
  await exclusive('session', async () => {
    const saved = (await chrome.storage.session.get(SESSION))[SESSION];
    if (saved?.id === id) await chrome.storage.session.remove(SESSION);
  });
}
export async function sessionIsCurrent(id: string, epoch: string | null): Promise<boolean> {
  const all = await chrome.storage.session.get(null);
  return (all[EPOCH] ?? null) === epoch && all[SESSION]?.id === id && all[SESSION]?.epoch === epoch;
}
export async function restoreSession(meta: VaultMetadata, epoch: string | null, current: () => boolean): Promise<{ key: CryptoKey; id: string } | null> {
  return exclusive('session', async () => {
    if (!current() || await sessionEpoch() !== epoch || !current()) throw new CancelledError();
    const saved = (await chrome.storage.session.get(SESSION))[SESSION];
    if (!saved) return null;
    try {
      if (typeof saved.id !== 'string' || saved.epoch !== epoch || saved.fingerprint !== fingerprint(meta)) throw new Error();
      base64Bytes(saved.key, 32, 32);
      const bytes = decodeBase64(saved.key);
      let key: CryptoKey;
      try { key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
      finally { bytes.fill(0); }
      await verifyKey(key, meta);
      if (!current()) throw new CancelledError();
      return { key, id: saved.id };
    } catch (error) {
      if (error instanceof CancelledError) throw error;
      await chrome.storage.session.remove(SESSION);
      return null;
    }
  });
}
