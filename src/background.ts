import { protectStorage } from './core/storage';
import { reconcileSync } from './core/sync';
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') void reconcileSync(changes).catch(() => { /* Chrome retains its last accepted ciphertext on failure. */ });
});
void protectStorage().catch(() => { /* Popup initialization also enforces this policy. */ });
