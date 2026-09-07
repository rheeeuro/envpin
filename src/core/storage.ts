import { stableJson } from './serialization';
import type { SecretRepository, StoredEncryptedSecret, VaultMetadata } from '../types';
import { UserError } from './errors';
import { validateMetadata, validateRecord, isDeleted } from './validation';
import { vaultIdentity } from './crypto';
export { UserError } from './errors';
export const META = 'vault:metadata';
export const PREFIX = 'secret:';
export const DELETED = 'deleted:';
export const DESCRIPTOR = 'vault:descriptor:';
export const CONFLICT = 'Multiple vaults were found in Chrome Sync. All available vault metadata is preserved. Changes are paused; see the recovery guide.';
export async function protectStorage() {
  await chrome.storage.sync.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}
// The caller holds the sync Web Lock for multi-step mutations.
export async function writeItem(key: string, value: unknown) {
  const all = await chrome.storage.sync.get(null);
  const bytes = (k: string, v: unknown) => new TextEncoder().encode(k + JSON.stringify(v)).length;
  if (bytes(key, value) > 8192) throw new UserError('This key is too large for Chrome Sync. Shorten the secret or note.');
  all[key] = value;
  const reserve = key.startsWith(PREFIX) ? 1024 : 0;
  if (Object.keys(all).length > (reserve ? 511 : 512) || Object.entries(all).reduce((n, [k, v]) => n + bytes(k, v), 0) > 102400 - reserve) throw new UserError('Chrome Sync storage is full. Deletion records also use space and cannot be safely cleared automatically.');
  try { await chrome.storage.sync.set({ [key]: value }); }
  catch { throw new UserError('Unable to save to Chrome Sync. Storage may be full or busy. Try again shortly.'); }
}
export async function getMetadata(): Promise<VaultMetadata | null> {
  const value = (await chrome.storage.sync.get(META))[META];
  return value === undefined ? null : validateMetadata(value);
}
export async function preserveMetadata(meta: VaultMetadata) {
  validateMetadata(meta);
  const name = DESCRIPTOR + vaultIdentity(meta);
  const existing = (await chrome.storage.sync.get(name))[name];
  if (existing !== undefined) {
    if (stableJson(existing) !== stableJson(meta)) throw new UserError(CONFLICT);
    return;
  }
  await writeItem(name, meta);
}
export async function checkVaultConflict(meta: VaultMetadata) {
  const all = await chrome.storage.sync.get(null);
  for (const [name, value] of Object.entries(all)) {
    if (name.startsWith(DESCRIPTOR)) {
      const descriptor = validateMetadata(value);
      if (name !== DESCRIPTOR + vaultIdentity(descriptor) || stableJson(descriptor) !== stableJson(meta)) throw new UserError(CONFLICT);
    }
    if (name.startsWith(PREFIX) || name.startsWith(DELETED)) {
      const record = validateRecord(value, name.slice(name.indexOf(':') + 1));
      if (record.version === 2 && record.vaultId !== vaultIdentity(meta)) throw new UserError(CONFLICT);
    }
  }
}
export function compareRecords(a: StoredEncryptedSecret, b: StoredEncryptedSecret): number {
  // Deletion is permanent for an ID, even if an offline client edits it later.
  if (isDeleted(a) !== isDeleted(b)) return isDeleted(a) ? 1 : -1;
  return a.updatedAt - b.updatedAt || (a.ciphertext > b.ciphertext ? 1 : a.ciphertext < b.ciphertext ? -1 : 0);
}
export const repository: SecretRepository = {
  async getAll() {
    const all = await chrome.storage.sync.get(null);
    const records = new Map<string, StoredEncryptedSecret>();
    for (const [name, value] of Object.entries(all)) {
      if (!name.startsWith(PREFIX) && !name.startsWith(DELETED)) continue;
      const record = validateRecord(value, name.slice(name.indexOf(':') + 1));
      if (name.startsWith(DELETED) && !isDeleted(record)) throw new UserError('Invalid deletion record.');
      const previous = records.get(record.id);
      if (!previous || compareRecords(record, previous) > 0) records.set(record.id, record);
    }
    return [...records.values()];
  },
  async get(id) {
    const tombstone = (await chrome.storage.sync.get(DELETED + id))[DELETED + id];
    if (tombstone !== undefined) {
      const record = validateRecord(tombstone, id);
      if (!isDeleted(record)) throw new UserError('Invalid deletion record.');
      return record;
    }
    const value = (await chrome.storage.sync.get(PREFIX + id))[PREFIX + id];
    return value === undefined ? null : validateRecord(value, id);
  },
  async set(secret) {
    validateRecord(secret);
    const previous = await this.get(secret.id);
    if (previous && compareRecords(previous, secret) > 0) throw new UserError('This key changed or was deleted on another browser. Return to the list and try again.');
    if (isDeleted(secret)) {
      // Commit the permanent marker before removing ciphertext. Readers prefer it
      // immediately, even before the worker sees an outdated remote edit.
      await writeItem(DELETED + secret.id, secret);
      await chrome.storage.sync.remove(PREFIX + secret.id);
    } else {
      await writeItem(PREFIX + secret.id, secret);
    }
  },
};
export function subscribeStorage(callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) {
  chrome.storage.onChanged.addListener(callback);
  return () => chrome.storage.onChanged.removeListener(callback);
}
export async function hasVaultData(): Promise<boolean> {
  const all = await chrome.storage.sync.get(null);
  return Object.keys(all).some(name => name === META || name.startsWith(PREFIX) || name.startsWith(DELETED) || name.startsWith(DESCRIPTOR));
}
