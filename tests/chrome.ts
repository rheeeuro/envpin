import { vi } from 'vitest';
export function mockChrome() {
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
  const stores: Record<string, Record<string, unknown>> = { sync: {}, session: {}, local: {} };
  function area(name: string) {
    return {
      setAccessLevel: vi.fn(async () => {}),
      get: vi.fn(async (key: string | null) => structuredClone(key === null ? stores[name] : { [key]: stores[name][key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(items)) { if (JSON.stringify(stores[name][key]) === JSON.stringify(value)) continue; changes[key] = { oldValue: structuredClone(stores[name][key]), newValue: structuredClone(value) }; stores[name][key] = structuredClone(value); }
        if (Object.keys(changes).length) listeners.forEach(fn => fn(changes, name));
      }),
      remove: vi.fn(async (key: string) => { const oldValue = stores[name][key]; delete stores[name][key]; if (oldValue !== undefined) listeners.forEach(fn => fn({ [key]: { oldValue } }, name)); }),
    };
  }
  const storage = { sync: area('sync'), session: area('session'), local: area('local'), onChanged: { addListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.add(fn), removeListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.delete(fn) } };
  vi.stubGlobal('chrome', { storage });
  return { stores, storage };
}
