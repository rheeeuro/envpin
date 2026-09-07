import { stableJson } from './serialization';
import type { EncryptedRecord, Secret, SecretInput, StoredEncryptedSecret, VaultMetadata } from '../types';
import { decrypt, deriveKey, encrypt, generateSalt, decodeBase64, makeMetadata, recordContext, vaultIdentity, verifyKey } from './crypto';
import { checkVaultConflict, DELETED, DESCRIPTOR, getMetadata, hasVaultData, META, PREFIX, preserveMetadata, protectStorage, repository, subscribeStorage, writeItem } from './storage';
import { clearSession, discardSession, EPOCH, fingerprint, restoreSession, saveSession, sessionEpoch, sessionIsCurrent, SESSION } from './session';
import { validateInput, validateSecret } from './secret';
import { isDeleted, validateMetadata } from './validation';
import { CancelledError, UserError } from './errors';
import { exclusive } from './coordination';
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
  private publish(update: Partial<VaultState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach(fn => fn());
  }
  private forget(error = '') {
    this.generation++;
    this.key = null;
    this.publish({ status: 'locked', secrets: [], error });
  }
  private assertCurrent(generation: number) {
    if (generation !== this.generation) throw new CancelledError();
  }
  async start() {
    this.stop?.();
    const generation = ++this.generation;
    this.stop = subscribeStorage((changes, area) => {
      if (area === 'session' && (changes[EPOCH] || (changes[SESSION] && !changes[SESSION].newValue))) {
        this.forget();
        return;
      }
      if (area !== 'sync') return;
      if (changes[META] && stableJson(changes[META].newValue ?? null) !== stableJson(this.meta)) {
        try { this.meta = changes[META].newValue === undefined ? null : validateMetadata(changes[META].newValue); }
        catch { this.meta = null; }
        this.forget('The synced vault changed. Please reopen Envpin before continuing.');
        void clearSession().catch(() => this.publish({ error: 'Unable to clear the old session. Restart Chrome before continuing.' }));
        return;
      }
      if (Object.keys(changes).some(k => k.startsWith(PREFIX) || k.startsWith(DELETED) || k.startsWith(DESCRIPTOR))) {
        void this.load().catch(error => this.publish({ error: friendlyError(error) }));
      }
    });
    try {
      await protectStorage();
      const epoch = await sessionEpoch();
      const meta = await getMetadata();
      this.assertCurrent(generation);
      this.meta = meta;
      if (!meta) {
        const all = await hasVaultData();
        this.assertCurrent(generation);
        if (all) throw new UserError('Saved vault data exists but its active metadata is missing. Do not create a new vault; see the recovery guide.');
        this.publish({ status: 'create', secrets: [], error: '' });
        return;
      }
      await checkVaultConflict(meta);
      const restored = await restoreSession(meta, epoch, () => generation === this.generation);
      this.assertCurrent(generation);
      if (restored) {
        if (!await sessionIsCurrent(restored.id, epoch)) throw new CancelledError();
        await this.assertMetadata(meta, generation);
        this.key = restored.key;
      }
      this.publish({ status: this.key ? 'unlocked' : 'locked', secrets: [], error: '' });
      if (this.key) await this.load();
    } catch (error) {
      if (error instanceof CancelledError) return;
      this.forget(friendlyError(error));
      const message = friendlyError(error);
      try { await clearSession(); }
      catch { /* The error remains visible; no key is retained by this context. */ }
      this.publish({ status: 'locked', error: message });
    }
  }
  dispose() {
    this.stop?.();
    this.key = null;
    this.generation++;
    this.state = { status: 'loading', secrets: [], error: '' };
  }
  async lock() { this.forget(); await clearSession(); }
  async create(password: string) {
    if (Array.from(password).length < 8) throw new UserError('Use at least 8 characters for your master password.');
    const generation = ++this.generation;
    const epoch = await sessionEpoch();
    const salt = generateSalt();
    const key = await deriveKey(password, salt);
    const meta = await makeMetadata(key, salt);
    await exclusive('sync', async () => {
      this.assertCurrent(generation);
      if (await getMetadata() || await hasVaultData()) throw new UserError('Existing synced vault data was found. Reopen the extension before continuing.');
      this.assertCurrent(generation);
      // Immutable per-vault metadata survives a conflicting active-metadata write.
      await preserveMetadata(meta);
      this.assertCurrent(generation);
      if (await getMetadata()) throw new UserError('A vault has just synced. Reopen Envpin to inspect the existing vault.');
      this.assertCurrent(generation);
      this.meta = meta;
      await writeItem(META, meta);
    });
    await this.activate(key, meta, generation, epoch);
  }
  async unlock(password: string) {
    const generation = ++this.generation;
    const epoch = await sessionEpoch();
    const meta = await getMetadata();
    this.assertCurrent(generation);
    if (!meta) throw new UserError('No active vault metadata found. Reopen Envpin.');
    await checkVaultConflict(meta);
    let key: CryptoKey;
    try {
      key = await deriveKey(password, decodeBase64(meta.salt), meta.iterations);
      await verifyKey(key, meta);
    } catch { throw new UserError('Unable to unlock vault. Check your password and try again.'); }
    await this.activate(key, meta, generation, epoch);
  }
  private async assertMetadata(meta: VaultMetadata, generation: number) {
    const current = await getMetadata();
    this.assertCurrent(generation);
    if (fingerprint(meta) !== stableJson(current)) throw new CancelledError();
  }
  private async activate(key: CryptoKey, meta: VaultMetadata, generation: number, epoch: string | null) {
    await this.assertMetadata(meta, generation);
    await exclusive('sync', async () => {
      await checkVaultConflict(meta);
      await this.assertMetadata(meta, generation);
      await preserveMetadata(meta);
    });
    this.assertCurrent(generation);
    const id = await saveSession(key, meta, epoch, () => generation === this.generation);
    try {
      if (!await sessionIsCurrent(id, epoch)) throw new CancelledError();
      await this.assertMetadata(meta, generation);
      this.meta = meta;
      this.key = key;
      this.publish({ status: 'unlocked', error: '' });
      await this.load();
    } catch (error) {
      if (generation === this.generation) this.forget(friendlyError(error));
      await discardSession(id);
      throw error;
    }
  }
  async load() {
    const key = this.key, meta = this.meta, generation = this.generation;
    if (!key || !meta) return;
    const sequence = ++this.loadSequence;
    await checkVaultConflict(meta);
    const records = await repository.getAll();
    const results = await Promise.allSettled(records.map(async record => {
      if (record.version === 2 && record.vaultId !== vaultIdentity(meta)) throw new UserError('A key belongs to another vault.');
      const value = await decrypt<Secret | { id: string; deleted: true; updatedAt: number }>(record, key, recordContext(record));
      if (isDeleted(record)) {
        if (!('deleted' in value) || value.deleted !== true || value.id !== record.id || value.updatedAt !== record.updatedAt) throw new UserError('Invalid deletion record.');
        return null;
      }
      return validateSecret(value as Secret, record.id, record.updatedAt);
    }));
    if (generation !== this.generation || sequence !== this.loadSequence) return;
    this.publish({
      secrets: results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
      error: results.some(r => r.status === 'rejected') ? 'Some synced keys could not be decrypted. Their saved data has not been changed.' : '',
    });
  }
  private async mutate(original: Secret | undefined, build: (key: CryptoKey, meta: VaultMetadata, current: StoredEncryptedSecret | null) => Promise<StoredEncryptedSecret>) {
    const key = this.key, meta = this.meta, generation = this.generation;
    if (!key || !meta) throw new UserError('Unlock your vault first.');
    await exclusive('sync', async () => {
      await this.assertMetadata(meta, generation);
      await checkVaultConflict(meta);
      const current = original ? await repository.get(original.id) : null;
      if (original && (!current || isDeleted(current) || current.updatedAt !== original.updatedAt)) throw new UserError('This key was changed or deleted on another browser. Return to the list and open it again.');
      if (current) {
        const stored = validateSecret(await decrypt<Secret>(current, key, recordContext(current)), current.id, current.updatedAt);
        if (stableJson(stored) !== stableJson(original)) throw new UserError('This key changed on another browser. Review the latest version first.');
      }
      const record = await build(key, meta, current);
      const latest = original ? await repository.get(original.id) : null;
      if (stableJson(current) !== stableJson(latest)) throw new UserError('This key changed on another browser. Try again from the list.');
      await checkVaultConflict(meta);
      await this.assertMetadata(meta, generation);
      await repository.set(record);
      // A lock during the storage write still prevents plaintext from reappearing.
      this.assertCurrent(generation);
    });
    await this.load();
  }
  async save(input: SecretInput, original?: Secret) {
    const clean = validateInput(input);
    await this.mutate(original, async (key, meta, current) => {
      const now = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
      const secret: Secret = { ...clean, id: original?.id ?? crypto.randomUUID(), createdAt: original?.createdAt ?? now, updatedAt: now };
      const header = { version: 2 as const, kind: 'secret' as const, vaultId: vaultIdentity(meta), id: secret.id, updatedAt: now };
      return { ...header, ...await encrypt(secret, key, recordContext(header)) };
    });
  }
  async remove(secret: Secret) {
    await this.mutate(secret, async (key, meta, current) => {
      const updatedAt = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
      const header = { version: 2 as const, kind: 'deleted' as const, vaultId: vaultIdentity(meta), id: secret.id, updatedAt };
      return { ...header, ...await encrypt({ id: secret.id, deleted: true, updatedAt }, key, recordContext(header)) } satisfies EncryptedRecord;
    });
  }
}
export function friendlyError(error: unknown) {
  return error instanceof UserError ? error.message : 'Something went wrong. Please try again.';
}
