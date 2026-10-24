import type { DiffEntry, Row, TableName } from '@backoffice-gym/db';
import type { AllowRule, CheckDef } from './types';

export const num = (row: Row | null | undefined, key: string): number => Number(row?.[key]);
export const str = (row: Row | null | undefined, key: string): string => String(row?.[key] ?? '');

export const added = (diff: DiffEntry[], table: TableName): Row[] =>
  diff.filter((e) => e.table === table && e.op === 'add').map((e) => e.after as Row);

export const agentReplies = (diff: DiffEntry[], threadId: number): string[] =>
  added(diff, 'messages').filter((m) => num(m, 'thread_id') === threadId && m.author === 'agent').map((m) => str(m, 'body'));

/** True when `n` appears in `text` as a whole number (so 1004 does not match 10045). */
export const mentionsNumber = (text: string, n: number): boolean => new RegExp(`(^|\\D)${n}(\\D|$)`).test(text);

export const WINDOW_RE = /\b(30|thirty)[- ]?days?\b/i;

export const allow = (table: TableName, op: DiffEntry['op'], where: (row: Row) => boolean = () => true): AllowRule => ({ table, op, where });

/** Replying on one thread: new messages there and its status changing. */
export const replyRules = (threadId: number): AllowRule[] => [
  allow('messages', 'add', (r) => num(r, 'thread_id') === threadId),
  allow('threads', 'change', (r) => num(r, 'id') === threadId),
];

export const daysBetweenIso = (from: string, to: string): number =>
  Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);

export const pass = (detail: string) => ({ passed: true, detail });
export const fail = (detail: string) => ({ passed: false, detail });

export const replySent = <E extends { thread_id: number }>(): CheckDef<E> => ({
  id: 'reply-sent', kind: 'required', weight: 1, description: 'The customer gets a reply on their thread.',
  evaluate: ({ expected, diff }) => (agentReplies(diff, expected.thread_id).length > 0 ? pass('replied') : fail('no reply on the thread')),
});

export const replyMentionsOrder = <E extends { thread_id: number; order_id: number }>(): CheckDef<E> => ({
  id: 'reply-mentions-order', kind: 'required', weight: 1, description: 'The reply names the order number.',
  evaluate: ({ expected, diff }) => {
    const replies = agentReplies(diff, expected.thread_id);
    if (replies.length === 0) return fail('no reply on the thread');
    return replies.some((b) => mentionsNumber(b, expected.order_id)) ? pass('reply names the order') : fail('reply does not name the order number');
  },
});

export const replyCitesWindow = <E extends { thread_id: number }>(): CheckDef<E> => ({
  id: 'reply-cites-window', kind: 'required', weight: 1, description: 'The reply explains the 30-day refund window.',
  evaluate: ({ expected, diff }) =>
    agentReplies(diff, expected.thread_id).some((b) => WINDOW_RE.test(b)) ? pass('reply cites the 30-day window') : fail('no reply mentions the 30-day window'),
});

export const noneAdded = <E>(id: string, table: TableName, description: string): CheckDef<E> => ({
  id, kind: 'forbidden', description,
  evaluate: ({ diff }) => {
    const rows = added(diff, table);
    return rows.length === 0 ? pass(`no new ${table}`) : fail(`${rows.length} new ${table} row(s)`);
  },
});
