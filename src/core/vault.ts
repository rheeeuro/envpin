import type { Secret, SecretInput, VaultMetadata } from '../types';
import { decrypt, deriveKey, encrypt, generateSalt, decodeBase64, makeMetadata, secretContext, verifyKey } from './crypto';
import { getMetadata, META, PREFIX, protectStorage, repository, subscribeStorage, UserError, writeItem } from './storage';
import { clearSession, fingerprint, restoreSession, saveSession, SESSION } from './session';
import { validateInput, validateSecret } from './secret';
export interface VaultState { status: 'loading' | 'create' | 'locked' | 'unlocked'; secrets: Secret[]; error: string }
export class Vault {
  private key: CryptoKey | null = null;
  private meta: VaultMetadata | null = null;
  private generation = 0;
  private loadSequence = 0;
  private listeners = new Set<() => void>();
  private stop?: () => void;
  private state: VaultState = { status: 'loading', secrets: [], error: '' };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<VaultState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(fn => fn()); }
  async start() {
    this.stop = subscribeStorage((changes, area) => {
      if (area === 'session' && changes[SESSION] && !changes[SESSION].newValue) { this.forget(); return; }
      if (area !== 'sync') return;
      if (changes[META]) { void this.refreshMetadata(); return; }
      if (Object.keys(changes).some(k => k.startsWith(PREFIX))) void this.load().catch(() => this.publish({ error: 'Unable to refresh synced keys. Lock and unlock to retry.' }));
    });
    try {
      await protectStorage();
      this.meta = await getMetadata();
      if (!this.meta) { this.publish({ status: 'create' }); return; }
      this.key = await restoreSession(this.meta);
      this.publish({ status: this.key ? 'unlocked' : 'locked' });
      if (this.key) await this.load();
    } catch { this.publish({ status: 'locked', error: 'Unable to load the vault. Reopen the extension to retry.' }); }
  }
  dispose() { this.stop?.(); this.key = null; this.generation++; this.state = { status: 'loading', secrets: [], error: '' }; }
  private forget() { this.generation++; this.key = null; this.publish({ status: this.meta ? 'locked' : 'create', secrets: [], error: '' }); }
  async lock() { this.forget(); await clearSession(); }
  private async refreshMetadata() {
    try { const meta = await getMetadata(); if (JSON.stringify(meta) === JSON.stringify(this.meta)) return; this.meta = meta; await this.lock(); }
    catch { this.forget(); this.publish({ error: 'Unable to read synced vault metadata.' }); }
  }
  async create(password: string) {
    if (!password) throw new UserError('Enter a master password.');
    if (await getMetadata() || (await repository.getAll()).length) { await this.refreshMetadata(); throw new UserError('Existing synced vault data was found. Reopen the extension before continuing.'); }
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const meta = await makeMetadata(key, salt);
    if (await getMetadata()) { await this.refreshMetadata(); throw new UserError('A vault has just synced. Unlock the existing vault instead.'); }
    this.meta = meta;
    await writeItem(META, meta);
    await this.activate(key, meta);
  }
  async unlock(password: string) {
    const generation = this.generation;
    const meta = await getMetadata();
    if (!meta) { await this.refreshMetadata(); throw new UserError('No vault found. Create a vault first.'); }
    let key: CryptoKey;
    try { key = await deriveKey(password, decodeBase64(meta.salt), meta.iterations); await verifyKey(key, meta); }
    catch { throw new UserError('Unable to unlock vault. Check your password and try again.'); }
    if (generation !== this.generation) throw new UserError('The vault changed. Please unlock again.');
    await this.activate(key, meta);
  }
  private async activate(key: CryptoKey, meta: VaultMetadata) {
    if (fingerprint(meta) !== JSON.stringify(await getMetadata())) throw new UserError('The synced vault changed. Please unlock again.');
    await saveSession(key, meta);
    this.meta = meta; this.key = key; this.generation++;
    this.publish({ status: 'unlocked', error: '' });
    await this.load();
  }
  async load() {
    const key = this.key, generation = this.generation;
    if (!key) return;
    const sequence = ++this.loadSequence;
    const records = await repository.getAll();
    const results = await Promise.allSettled(records.map(async r => validateSecret(await decrypt<Secret>(r, key, secretContext(r.id, r.updatedAt)), r.id, r.updatedAt)));
    if (generation !== this.generation || sequence !== this.loadSequence) return;
    this.publish({ secrets: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)), error: results.some(r => r.status === 'rejected') ? 'Some synced keys could not be decrypted. Their saved data has not been changed.' : '' });
  }
  async save(input: SecretInput, original?: Secret) {
    const key = this.key, generation = this.generation;
    if (!key || !this.meta) throw new UserError('Unlock your vault first.');
    const clean = validateInput(input);
    const current = original ? await repository.get(original.id) : null;
    if (original && (!current || current.updatedAt !== original.updatedAt)) throw new UserError('This key was changed or deleted on another browser. Return to the list and open it again.');
    const now = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
    const secret: Secret = { ...clean, id: original?.id ?? crypto.randomUUID(), createdAt: original?.createdAt ?? now, updatedAt: now };
    const encrypted = await encrypt(secret, key, secretContext(secret.id, now));
    if (generation !== this.generation || JSON.stringify(await getMetadata()) !== fingerprint(this.meta)) throw new UserError('The vault changed or was locked. Unlock and try again.');
    await repository.set({ version: 1, id: secret.id, updatedAt: now, ...encrypted });
    await this.load();
  }
  async remove(secret: Secret) {
    if (!this.key || !this.meta) throw new UserError('Unlock your vault first.');
    const generation = this.generation;
    const current = await repository.get(secret.id);
    if (current && current.updatedAt !== secret.updatedAt) throw new UserError('This key changed on another browser. Review it before deleting.');
    if (generation !== this.generation || JSON.stringify(await getMetadata()) !== fingerprint(this.meta)) throw new UserError('The vault changed or was locked. Unlock and try again.');
    await repository.remove(secret.id); await this.load();
  }
}
export function friendlyError(error: unknown) { return error instanceof UserError ? error.message : 'Something went wrong. Please try again.'; }
