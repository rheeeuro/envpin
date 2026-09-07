import { PREFIX, repository } from './storage';
import type { StoredEncryptedSecret } from '../types';
function isRecord(value: unknown, name: string): value is StoredEncryptedSecret {
  const v = value as StoredEncryptedSecret | undefined;
  return !!v && v.version === 1 && name === PREFIX + v.id && typeof v.iv === 'string' && typeof v.ciphertext === 'string' && Number.isFinite(v.updatedAt);
}
// This worker only handles ciphertext. It never accesses session keys or plaintext.
export async function reconcileSync(changes: Record<string, chrome.storage.StorageChange>) {
  for (const [name, { oldValue, newValue }] of Object.entries(changes)) {
    // A missing newValue is a deletion; never resurrect it.
    if (!isRecord(oldValue, name) || !isRecord(newValue, name)) continue;
    const newer = oldValue.updatedAt > newValue.updatedAt || (oldValue.updatedAt === newValue.updatedAt && oldValue.ciphertext > newValue.ciphertext);
    if (newer && JSON.stringify(await repository.get(oldValue.id)) === JSON.stringify(newValue)) await repository.set(oldValue);
  }
}
