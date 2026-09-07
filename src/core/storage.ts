import type { SecretRepository, StoredEncryptedSecret, VaultMetadata } from '../types';
export const META = 'vault:metadata';
export const PREFIX = 'secret:';
export class UserError extends Error {}
export async function protectStorage() { await chrome.storage.sync.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }); }
export async function writeItem(key: string, value: unknown) {
  const all = await chrome.storage.sync.get(null);
  const bytes = (k: string, v: unknown) => new TextEncoder().encode(k + JSON.stringify(v)).length;
  if (bytes(key, value) > 8192) throw new UserError('This key is too large for Chrome Sync. Shorten the secret or note.');
  all[key] = value;
  if (Object.keys(all).length > 512 || Object.entries(all).reduce((n, [k, v]) => n + bytes(k, v), 0) > 102400) throw new UserError('Your Chrome Sync storage is full. Delete unused keys first.');
  try { await chrome.storage.sync.set({ [key]: value }); } catch { throw new UserError('Unable to save to Chrome Sync. Storage may be full or busy. Try again shortly.'); }
}
export async function getMetadata(): Promise<VaultMetadata | null> { return (await chrome.storage.sync.get(META))[META] ?? null; }
export const repository: SecretRepository = {
  async getAll() { const all = await chrome.storage.sync.get(null); return Object.entries(all).filter(([k]) => k.startsWith(PREFIX)).map(([k, v]) => { if (v?.id !== k.slice(PREFIX.length) || v?.version !== 1) throw new UserError('Some synced data is invalid. Your saved keys have not been changed.'); return v as StoredEncryptedSecret; }); },
  async get(id) { return (await chrome.storage.sync.get(PREFIX + id))[PREFIX + id] ?? null; },
  async set(secret) { const previous = await this.get(secret.id); if (previous && previous.updatedAt > secret.updatedAt) return; await writeItem(PREFIX + secret.id, secret); },
  async remove(id) { await chrome.storage.sync.remove(PREFIX + id); },
};
export function subscribeStorage(callback: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) { chrome.storage.onChanged.addListener(callback); return () => chrome.storage.onChanged.removeListener(callback); }
