import { vi } from 'vitest';
import { stableJson } from '../src/core/serialization';
const storageClone = <T>(value: T): T => value === undefined ? value : JSON.parse(stableJson(value)!);
export function mockChrome() {
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
  const stores: Record<string, Record<string, unknown>> = { sync: {}, session: {}, local: {} };
  function area(name: string) {
    return {
      setAccessLevel: vi.fn(async () => {}),
      get: vi.fn(async (key: string | null) => storageClone(key === null ? stores[name] : { [key]: stores[name][key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(items)) { if (JSON.stringify(stores[name][key]) === JSON.stringify(value)) continue; changes[key] = { oldValue: storageClone(stores[name][key]), newValue: storageClone(value) }; stores[name][key] = storageClone(value); }
        if (Object.keys(changes).length) listeners.forEach(fn => fn(changes, name));
      }),
      remove: vi.fn(async (key: string) => { const oldValue = stores[name][key]; delete stores[name][key]; if (oldValue !== undefined) listeners.forEach(fn => fn({ [key]: { oldValue } }, name)); }),
    };
  }
  const storage = { sync: area('sync'), session: area('session'), local: area('local'), onChanged: { addListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.add(fn), removeListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.delete(fn) } };
  const queues = new Map<string, Promise<unknown>>();
  vi.stubGlobal('navigator', { locks: { request: <T>(name: string, action: () => Promise<T>) => {
    const next = (queues.get(name) ?? Promise.resolve()).catch(() => {}).then(action);
    queues.set(name, next);
    return next;
  } } });
  vi.stubGlobal('chrome', { storage });
  return { stores, storage };
}
