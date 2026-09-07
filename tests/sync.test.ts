import { beforeEach, expect, it } from 'vitest';
import { mockChrome } from './chrome';
import { reconcileSync } from '../src/core/sync';
import { repository } from '../src/core/storage';
let mock: ReturnType<typeof mockChrome>;
beforeEach(() => { mock = mockChrome(); });
const record = { version: 1 as const, id: 'test', iv: 'iv', ciphertext: 'ciphertext', updatedAt: 20 };
it('retains the most recent timestamp even while locked', async () => {
  const stale = { ...record, updatedAt: 10 }; mock.stores.sync['secret:test'] = stale;
  await reconcileSync({ 'secret:test': { oldValue: record, newValue: stale } }); expect(await repository.get('test')).toEqual(record);
});
it('never resurrects a deleted key', async () => {
  await reconcileSync({ 'secret:test': { oldValue: record } }); expect(await repository.get('test')).toBeNull();
});
it('does not overwrite a change that arrived during reconciliation', async () => {
  const latest = { ...record, updatedAt: 30 }; mock.stores.sync['secret:test'] = latest;
  await reconcileSync({ 'secret:test': { oldValue: record, newValue: { ...record, updatedAt: 10 } } }); expect(await repository.get('test')).toEqual(latest);
});
it('settles equal timestamps deterministically', async () => {
  const winner = { ...record, ciphertext: 'z' }, loser = { ...record, ciphertext: 'a' }; mock.stores.sync['secret:test'] = loser;
  await reconcileSync({ 'secret:test': { oldValue: winner, newValue: loser } }); expect(await repository.get('test')).toEqual(winner);
});
