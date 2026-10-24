import { createHash } from 'node:crypto';

/** Environment tables in foreign-key-safe insert order. `episodes` and `action_log` are not part of store state. */
export const TABLES = [
  'customers', 'products', 'staff', 'orders', 'order_items', 'payments', 'refunds', 'replacements',
  'purchase_orders', 'approvals', 'threads', 'messages', 'calendar_events', 'budget', 'policy',
] as const;

export type TableName = (typeof TABLES)[number];
export type Row = Record<string, unknown>;
export type Dump = Record<TableName, Row[]>;

/** Anything with Prisma's `$queryRawUnsafe`: the client or a transaction client. */
export interface Queryable {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface DiffEntry {
  table: TableName;
  op: 'add' | 'remove' | 'change';
  id: number;
  before: Row | null;
  after: Row | null;
  /** Changed column names (only for `change`), sorted. */
  fields: string[];
}

export function emptyDump(): Dump {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Dump;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

/** Every row of one episode, per table, ordered by id, with `episode_id` removed and values JSON-normalized. */
export async function dumpEpisode(db: Queryable, episodeId: string): Promise<Dump> {
  const dump = emptyDump();
  for (const table of TABLES) {
    const rows = await db.$queryRawUnsafe<Row[]>(
      `SELECT * FROM "backoffice_gym"."${table}" WHERE episode_id = $1::uuid ORDER BY id`,
      episodeId,
    );
    dump[table] = rows.map((row) => {
      const copy: Row = { ...row };
      delete copy.episode_id;
      return normalize(copy) as Row;
    });
  }
  return dump;
}

/** JSON with object keys sorted at every level, so equal data always serializes identically. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function hashDump(dump: Dump): string {
  return createHash('sha256').update(stableStringify(dump)).digest('hex');
}

/** Row-level differences between two dumps, in table order, then by id. */
export function diffDumps(before: Dump, after: Dump): DiffEntry[] {
  const out: DiffEntry[] = [];
  for (const table of TABLES) {
    const prev = new Map((before[table] ?? []).map((r) => [Number(r.id), r]));
    const next = new Map((after[table] ?? []).map((r) => [Number(r.id), r]));
    const ids = [...new Set([...prev.keys(), ...next.keys()])].sort((a, b) => a - b);
    for (const id of ids) {
      const b = prev.get(id) ?? null;
      const a = next.get(id) ?? null;
      if (b && !a) out.push({ table, op: 'remove', id, before: b, after: null, fields: [] });
      else if (!b && a) out.push({ table, op: 'add', id, before: null, after: a, fields: [] });
      else if (a && b) {
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        const fields = keys.filter((k) => stableStringify(a[k]) !== stableStringify(b[k]));
        if (fields.length > 0) out.push({ table, op: 'change', id, before: b, after: a, fields });
      }
    }
  }
  return out;
}
