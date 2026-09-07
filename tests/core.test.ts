import { beforeEach, describe, expect, it } from 'vitest';
import { decodeBase64, decrypt, deriveKey, encrypt, generateSalt, makeMetadata, secretContext, verifyKey } from '../src/core/crypto';
import { maskSecret, matchesSearch } from '../src/core/secret';
import { Vault } from '../src/core/vault';
import { META, repository, writeItem } from '../src/core/storage';
import { SESSION } from '../src/core/session';
import { mockChrome } from './chrome';
const password = 'test-only master passphrase!';
const input = { service: 'Private test provider', name: 'Development', secret: 'test-only-secret-1234567890', website: 'https://example.com', note: 'confidential test note' };
let chromeMock: ReturnType<typeof mockChrome>;
beforeEach(() => { chromeMock = mockChrome(); });
async function created() { const vault = new Vault(); await vault.start(); await vault.create(password); return vault; }
describe('crypto', () => {
  it('derives AES-256, verifies passwords, round trips unicode, and uses fresh IVs', async () => {
    const salt = generateSalt(), key = await deriveKey(password, salt), same = await deriveKey(password, salt);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    const one = await encrypt({ value: '비밀🔑' }, key, 'test');
    const two = await encrypt({ value: '비밀🔑' }, key, 'test');
    expect(one.iv).not.toBe(two.iv); expect(decodeBase64(one.iv)).toHaveLength(12);
    expect(await decrypt(one, same, 'test')).toEqual({ value: '비밀🔑' });
    const meta = await makeMetadata(key, salt); await expect(verifyKey(same, meta)).resolves.toBeUndefined();
    const wrong = await deriveKey('wrong', salt); await expect(verifyKey(wrong, meta)).rejects.toThrow();
    await expect(decrypt(one, key, 'different-record')).rejects.toThrow();
    await expect(decrypt({ ...one, ciphertext: one.ciphertext.slice(0, -4) + 'AAAA' }, key, 'test')).rejects.toThrow();
  });
  it('rejects invalid KDF parameters', async () => { await expect(deriveKey(password, generateSalt(), 1)).rejects.toThrow(); });
});
describe('secrets', () => {
  it('masks short keys fully and only exposes limited characters of long keys', () => { expect(maskSecret('short')).toBe('••••••••'); expect(maskSecret('123456789012')).toBe('••••••••'); expect(maskSecret('sk-proj-abcdefghijklmnop')).toBe('sk-proj-••••••••••••mnop'); });
  it('searches metadata but never secret values', () => { const secret = { ...input, id: '1', createdAt: 1, updatedAt: 1 }; expect(matchesSearch(secret, 'PROVIDER')).toBe(true); expect(matchesSearch(secret, 'confidential')).toBe(true); expect(matchesSearch(secret, input.secret)).toBe(false); });
});
describe('vault and Chrome storage integration', () => {
  it('stores only ciphertext, restores popup sessions, and locks on browser restart', async () => {
    const vault = await created(); await vault.save(input);
    const serialized = JSON.stringify(chromeMock.stores.sync);
    for (const plain of [...Object.values(input), password]) expect(serialized).not.toContain(plain);
    expect(chromeMock.stores.local).toEqual({}); expect(JSON.stringify(chromeMock.stores.session)).not.toContain(password); expect(JSON.stringify(chromeMock.stores.session)).not.toContain(input.secret);
    vault.dispose(); const reopened = new Vault(); await reopened.start(); expect(reopened.getSnapshot().secrets[0]).toMatchObject(input);
    reopened.dispose(); chromeMock.stores.session = {};
    const restarted = new Vault(); await restarted.start(); expect(restarted.getSnapshot().status).toBe('locked');
    await expect(restarted.unlock('incorrect')).rejects.toThrow('Unable to unlock'); expect(restarted.getSnapshot().secrets).toEqual([]);
    await restarted.unlock(password); expect(restarted.getSnapshot().secrets[0]).toMatchObject(input); restarted.dispose();
  });
  it('updates, rejects stale edits, deletes and explicitly locks', async () => {
    const vault = await created(); await vault.save(input); const first = vault.getSnapshot().secrets[0];
    await vault.save({ ...input, name: 'Updated' }, first); const updated = vault.getSnapshot().secrets[0]; expect(updated.name).toBe('Updated');
    await expect(vault.save(input, first)).rejects.toThrow('changed or deleted');
    await expect(vault.remove(first)).rejects.toThrow('changed');
    await vault.remove(updated); expect(await repository.getAll()).toEqual([]);
    await vault.lock(); expect(vault.getSnapshot().status).toBe('locked'); expect(chromeMock.stores.session[SESSION]).toBeUndefined(); vault.dispose();
  });
  it('recovers on a new device using only synced ciphertext and the password', async () => {
    const vault = await created(); await vault.save(input); const synced = structuredClone(chromeMock.stores.sync); vault.dispose();
    chromeMock = mockChrome(); chromeMock.stores.sync = synced;
    const other = new Vault(); await other.start(); expect(other.getSnapshot().status).toBe('locked'); await other.unlock(password); expect(other.getSnapshot().secrets[0]).toMatchObject(input); other.dispose();
  });
  it('enforces item and total quotas before writing', async () => {
    await expect(writeItem('secret:large', { data: 'x'.repeat(8200) })).rejects.toThrow('too large');
    for (let i = 0; i < 15; i++) chromeMock.stores.sync['item' + i] = 'x'.repeat(7000);
    await expect(writeItem('secret:small', {})).rejects.toThrow('full'); expect(chromeMock.storage.sync.set).not.toHaveBeenCalled();
  });
  it('does not overwrite an existing vault or unreadable records', async () => {
    const vault = await created(); const meta = structuredClone(chromeMock.stores.sync[META]);
    await expect(vault.create('another')).rejects.toThrow('Existing'); expect(chromeMock.stores.sync[META]).toEqual(meta);
    await vault.save(input); const item = (await repository.getAll())[0]; await chromeMock.storage.sync.set({ ['secret:' + item.id]: { ...item, ciphertext: 'AAAA' } }); await vault.load();
    expect(vault.getSnapshot().error).toContain('could not be decrypted'); expect(await repository.get(item.id)).toMatchObject({ ciphertext: 'AAAA' }); vault.dispose();
  });
  it('rejects moving ciphertext to another record identity', async () => {
    const vault = await created(); await vault.save(input); const record = (await repository.getAll())[0];
    const meta = chromeMock.stores.sync[META] as { salt: string }; const key = await deriveKey(password, decodeBase64(meta.salt));
    await expect(decrypt(record, key, secretContext('another-id', record.updatedAt))).rejects.toThrow(); vault.dispose();
  });
});
