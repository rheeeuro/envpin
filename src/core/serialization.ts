// Chrome storage may return object properties in a different order.
// Equality and session fingerprints must not depend on insertion order.
export function stableJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return item;
  });
}
