import { stableJson } from './serialization';
import { compareRecords, DELETED, DESCRIPTOR, META, PREFIX, preserveMetadata, repository } from './storage';
import { validateMetadata, validateRecord, isDeleted } from './validation';
import { exclusive } from './coordination';
// This worker handles ciphertext and metadata only; it never reads session keys.
export async function reconcileSync(changes: Record<string, chrome.storage.StorageChange>) {
  await exclusive('sync', async () => {
    for (const [name, { oldValue, newValue }] of Object.entries(changes)) {
      if (name === META) {
        for (const value of [oldValue, newValue]) {
          if (value !== undefined) await preserveMetadata(validateMetadata(value));
        }
        continue;
      }
      if (name.startsWith(DESCRIPTOR) || (!name.startsWith(PREFIX) && !name.startsWith(DELETED))) continue;
      const id = name.slice(name.indexOf(':') + 1);
      const current = await repository.get(id);
      // A late offline secret cannot replace the separately retained tombstone.
      if (current && isDeleted(current)) {
        await chrome.storage.sync.remove(PREFIX + id);
        continue;
      }
      if (oldValue === undefined) continue;
      const old = validateRecord(oldValue, id);
      if (newValue === undefined) {
        if (isDeleted(old) && (!current || !isDeleted(current))) await repository.set(old);
        continue;
      }
      const next = validateRecord(newValue, id);
      if (old.version === 2 && next.version === 2 && old.vaultId !== next.vaultId) continue;
      if (compareRecords(old, next) > 0 && stableJson(await repository.get(id)) === stableJson(next)) await repository.set(old);
    }
  });
}
