// Node 20 has no Map.groupBy, which vitest's reporter uses when it prints failures: without this, one failing test crashes the reporter and hides which one.
type GroupBy = <K, T>(items: Iterable<T>, fn: (item: T, i: number) => K) => Map<K, T[]>;
const MapWithGroupBy = Map as unknown as { groupBy?: GroupBy };
if (!MapWithGroupBy.groupBy) {
  MapWithGroupBy.groupBy = (items, fn) => { const m = new Map(); let i = 0; for (const x of items) { const k = fn(x, i++); (m.get(k) ?? m.set(k, []).get(k)).push(x); } return m; };
}
