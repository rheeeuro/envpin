// Web Locks serialize read/check/write sequences across this extension's popup and worker.
// Chrome Sync itself remains asynchronous and is not a distributed transaction.
export function exclusive<T>(name: 'session' | 'sync', action: () => Promise<T>): Promise<T> {
  return navigator.locks.request(`envpin:${name}`, action);
}
