import { beforeEach, describe, expect, it } from 'vitest';
import { Vault } from '../src/core/vault';
import { mockChrome } from './chrome';
import { DELETED, DESCRIPTOR, getMetadata, META, repository, preserveMetadata } from '../src/core/storage';
import { EPOCH, SESSION } from '../src/core/session';
import { deriveKey, encrypt, generateSalt, encodeBase64, ITERATIONS, makeMetadata, recordContext, secretContext, vaultIdentity } from '../src/core/crypto';
import { validateMetadata, validateRecord } from '../src/core/validation';
import { reconcileSync } from '../src/core/sync';
const password = 'test-passphrase';
const input = { service: 'Test provider', name: 'Test key', secret: 'test-only-secret-value' };
let mock: ReturnType<typeof mockChrome>;
beforeEach(() => { mock = mockChrome(); });
async function created() { const vault = new Vault(); await vault.start(); await vault.create(password); return vault; }
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function pauseSessionWrite() {
  const entered = gate(), resume = gate();
  const original = mock.storage.session.set.getMockImplementation()!;
  mock.storage.session.set.mockImplementation(async items => {
    if (items[SESSION]) { entered.release(); await resume.promise; }
    await original(items);
  });
  return { entered, resume };
}
describe('lock and session regression', () => {
  it('cancels an unlock when lock occurs during session persistence', async () => {
    const vault = await created(); await vault.lock(); const pause = await pauseSessionWrite();
    const unlock = vault.unlock(password); const rejected = expect(unlock).rejects.toThrow('locked');
    await pause.entered.promise;
    const lock = vault.lock(); expect(vault.getSnapshot().status).toBe('locked');
    pause.resume.release(); await Promise.all([lock, rejected]);
    expect(vault.getSnapshot().secrets).toEqual([]); expect(mock.stores.session[SESSION]).toBeUndefined(); vault.dispose();
  });
  it('cancels an in-flight unlock from another extension context', async () => {
    const a = await created(); await a.lock(); const b = new Vault(); await b.start();
    const pause = await pauseSessionWrite(); const unlock = a.unlock(password); const settled = unlock.catch(() => {});
    await pause.entered.promise; const lock = b.lock(); pause.resume.release();
    await Promise.all([settled, lock]);
    expect(a.getSnapshot().status).toBe('locked'); expect(b.getSnapshot().status).toBe('locked'); expect(mock.stores.session[SESSION]).toBeUndefined(); a.dispose(); b.dispose();
  });
  it('does not persist a late session after popup disposal', async () => {
    const vault = await created(); await vault.lock(); const pause = await pauseSessionWrite();
    const pending = vault.unlock(password); const rejected = expect(pending).rejects.toThrow('locked');
    await pause.entered.promise; vault.dispose(); pause.resume.release(); await rejected;
    expect(mock.stores.session[SESSION]).toBeUndefined(); expect(vault.getSnapshot().secrets).toEqual([]);
  });
  it('invalidates an old session even if deleting its storage item fails', async () => {
    const vault = await created();
    mock.storage.session.remove.mockRejectedValueOnce(new Error('storage failure'));
    await expect(vault.lock()).rejects.toThrow(); expect(vault.getSnapshot().status).toBe('locked'); vault.dispose();
    const reopened = new Vault(); await reopened.start(); expect(reopened.getSnapshot().status).toBe('locked'); expect(mock.stores.session[SESSION]).toBeUndefined(); reopened.dispose();
  });
  it('clears key state when startup encounters corrupt metadata', async () => {
    const vault = await created(); vault.dispose(); mock.stores.sync[META] = { version: 99 };
    const reopened = new Vault(); await reopened.start(); expect(reopened.getSnapshot().status).toBe('locked'); expect(reopened.getSnapshot().secrets).toEqual([]); expect(mock.stores.session[SESSION]).toBeUndefined();
    await expect(reopened.save(input)).rejects.toThrow('Unlock'); reopened.dispose();
  });
  it('does not re-unlock while session restoration races with lock', async () => {
    const a = await created(); const b = new Vault(); const entered = gate(), resume = gate();
    const original = mock.storage.session.get.getMockImplementation()!;
    mock.storage.session.get.mockImplementationOnce(async name => { const value = await original(name); entered.release(); await resume.promise; return value; });
    const opening = b.start(); await entered.promise; await a.lock(); resume.release(); await opening;
    expect(b.getSnapshot().status).toBe('locked'); expect(b.getSnapshot().secrets).toEqual([]); a.dispose(); b.dispose();
  });
});
describe('password policy and backward compatibility', () => {
  it('rejects fewer than eight characters without writing anything', async () => {
    const vault = new Vault(); await vault.start(); await expect(vault.create('1234567')).rejects.toThrow('at least 8'); expect(mock.stores.sync).toEqual({}); vault.dispose();
  });
  it('accepts exactly eight characters', async () => {
    const vault = new Vault(); await vault.start(); await vault.create('12345678'); expect(vault.getSnapshot().status).toBe('unlocked'); vault.dispose();
  });
  it('opens a v1 vault with a short password and upgrades records only on edit', async () => {
    const salt = generateSalt(), key = await deriveKey('x', salt);
    const meta = { version: 1 as const, salt: encodeBase64(salt), iterations: ITERATIONS, createdAt: 1000, verification: await encrypt('API_KEY_VAULT_VERIFICATION_V1', key, 'envpin:vault:1') };
    const payload = { ...input, id: 'legacy-id', createdAt: 1000, updatedAt: 1000 };
    mock.stores.sync[META] = meta;
    mock.stores.sync['secret:legacy-id'] = { version: 1, id: payload.id, updatedAt: 1000, ...await encrypt(payload, key, secretContext(payload.id, 1000)) };
    const vault = new Vault(); await vault.start(); await vault.unlock('x'); expect(vault.getSnapshot().secrets).toEqual([payload]);
    expect(await repository.get(payload.id)).toMatchObject({ version: 1 });
    await vault.save({ ...input, name: 'Updated' }, payload);
    expect(await repository.get(payload.id)).toMatchObject({ version: 2, vaultId: vaultIdentity(meta) });
    expect(mock.stores.sync[META]).toEqual(meta); vault.dispose();
  });
});
describe('sync conflicts and deletion', () => {
  it('does not resurrect a deleted key when a later offline edit arrives', async () => {
    const vault = await created(); await vault.save(input); const secret = vault.getSnapshot().secrets[0]; const previous = (await repository.get(secret.id))!;
    await vault.remove(secret); const tombstone = (await repository.get(secret.id))!;
    expect(JSON.stringify(tombstone)).not.toContain(input.secret);
    const stale = { ...previous, updatedAt: tombstone.updatedAt + 1000 };
    await mock.storage.sync.set({ ['secret:' + secret.id]: stale });
    // A pending worker must not be required to hide the replayed key.
    await vault.load(); expect(vault.getSnapshot().secrets).toEqual([]);
    await reconcileSync({ ['secret:' + secret.id]: { oldValue: previous, newValue: stale } });
    await vault.load(); expect(vault.getSnapshot().secrets).toEqual([]); expect(await repository.get(secret.id)).toEqual(tombstone); vault.dispose();
  });
  it('hides and cleans up an old secret when its separate remote deletion arrives first', async () => {
    const vault = await created(); await vault.save(input); const secret = vault.getSnapshot().secrets[0];
    const old = (await repository.get(secret.id))!; await vault.remove(secret);
    const tombstone = (await repository.get(secret.id))!;
    mock.stores.sync['secret:' + secret.id] = old;
    await vault.load(); expect(vault.getSnapshot().secrets).toEqual([]);
    await reconcileSync({ [DELETED + secret.id]: { newValue: tombstone } });
    expect(mock.stores.sync['secret:' + secret.id]).toBeUndefined();
    expect(await repository.get(secret.id)).toEqual(tombstone); vault.dispose();
  });
  it('retains deletion records if an older client removes their storage item', async () => {
    const vault = await created(); await vault.save(input); const secret = vault.getSnapshot().secrets[0]; await vault.remove(secret); const tombstone = await repository.get(secret.id);
    await mock.storage.sync.remove(DELETED + secret.id);
    await reconcileSync({ [DELETED + secret.id]: { oldValue: tombstone } }); expect(await repository.get(secret.id)).toEqual(tombstone); vault.dispose();
  });
  it('serializes competing edits within the same browser', async () => {
    const vault = await created(); await vault.save(input); const secret = vault.getSnapshot().secrets[0];
    const results = await Promise.allSettled([vault.save({ ...input, name: 'One' }, secret), vault.save({ ...input, name: 'Two' }, secret)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.filter(r => r.status === 'rejected')).toHaveLength(1); vault.dispose();
  });
  it('preserves both vault descriptors and blocks writes on a metadata conflict', async () => {
    const vault = await created(); const first = (await getMetadata())!;
    const salt = generateSalt(), second = await makeMetadata(await deriveKey(password, salt), salt);
    await mock.storage.sync.set({ [META]: second });
    await reconcileSync({ [META]: { oldValue: first, newValue: second } });
    expect(mock.stores.sync[DESCRIPTOR + vaultIdentity(first)]).toEqual(first); expect(mock.stores.sync[DESCRIPTOR + vaultIdentity(second)]).toEqual(second);
    await expect(vault.unlock(password)).rejects.toThrow('Multiple vaults'); await expect(vault.save(input)).rejects.toThrow('Unlock'); vault.dispose();
  });
  it('refuses a fresh vault if orphaned descriptors exist', async () => {
    const vault = await created(); vault.dispose(); delete mock.stores.sync[META];
    const next = new Vault(); await next.start(); expect(next.getSnapshot().error).toContain('metadata is missing');
    await expect(next.create(password)).rejects.toThrow('Existing'); next.dispose();
  });
});
describe('untrusted storage validation', () => {
  it('rejects malformed KDF, salt, timestamps, ciphertext and versions', async () => {
    const vault = await created(); const meta = (await getMetadata())!;
    for (const change of [{ iterations: 1 }, { iterations: 9e20 }, { salt: 'invalid' }, { version: 99 }, { createdAt: NaN }]) expect(() => validateMetadata({ ...meta, ...change })).toThrow();
    await vault.save(input); const record = (await repository.getAll())[0];
    for (const change of [{ version: 99 }, { updatedAt: -1 }, { updatedAt: Infinity }, { iv: 'AAAA' }, { ciphertext: 'AAAA' }, { vaultId: '../x' }, { kind: 'other' }]) expect(() => validateRecord({ ...record, ...change })).toThrow();
    vault.dispose();
  });
  it('detects authenticated vault ID and record kind tampering', async () => {
    const vault = await created(); const meta = (await getMetadata())!; await vault.save(input); const record = (await repository.getAll())[0];
    await mock.storage.sync.set({ ['secret:' + record.id]: { ...record, kind: 'deleted' } });
    await vault.load(); expect(vault.getSnapshot().error).toContain('could not be decrypted');
    await mock.storage.sync.set({ ['secret:' + record.id]: { ...record, vaultId: 'another-vault' } });
    await expect(vault.load()).rejects.toThrow('Multiple vaults');
    expect(mock.stores.sync[META]).toEqual(meta); vault.dispose();
  });
});
