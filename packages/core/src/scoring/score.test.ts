import { diffDumps, emptyDump, type Dump } from '@shopgym/db';
import { describe, expect, it } from 'vitest';
import { allow, fail, pass } from '../tasks/checks';
import type { TaskTemplate } from '../tasks/types';
import { isDuplicatePayment, scoreTask } from './score';

type E = { order_id: number };
const STORE_DATE = '2026-03-20';

function store(): Dump {
  const d = emptyDump();
  d.orders.push(
    { id: 1001, customer_id: 1, status: 'delivered', delivered_on: '2026-03-10T00:00:00.000Z', total_cents: 6499 },
    { id: 1002, customer_id: 2, status: 'delivered', delivered_on: '2026-01-10T00:00:00.000Z', total_cents: 6499 },
    { id: 1003, customer_id: 3, status: 'processing', delivered_on: null, total_cents: 6499 },
  );
  d.payments.push(
    { id: 1, order_id: 1001, amount_cents: 6499, status: 'captured' },
    { id: 2, order_id: 1002, amount_cents: 6499, status: 'captured' },
    { id: 3, order_id: 1003, amount_cents: 6499, status: 'captured' },
    { id: 4, order_id: 1003, amount_cents: 6499, status: 'captured' },
  );
  return d;
}

const task = (checks: TaskTemplate<E>['checks']): TaskTemplate<E> => ({
  slug: 't', title: 't', summary: 't', generate: () => { throw new Error('unused'); }, checks,
  allowed: (e) => [allow('refunds', 'add', (r) => Number(r.order_id) === e.order_id), allow('payments', 'change'), allow('orders', 'change')],
});

const refund = (d: Dump, id: number, order_id: number, payment_id: number, amount_cents: number) => d.refunds.push({ id, order_id, payment_id, amount_cents });

function score(t: TaskTemplate<E>, final: Dump, expected: E = { order_id: 1001 }) {
  const initial = store();
  return scoreTask(t, { expected, initial, final, diff: diffDumps(initial, final), storeDate: STORE_DATE });
}

describe('scoreTask', () => {
  it('weights required checks', () => {
    const t = task([
      { id: 'a', kind: 'required', weight: 3, description: '', evaluate: () => pass('ok') },
      { id: 'b', kind: 'required', weight: 1, description: '', evaluate: () => fail('no') },
    ]);
    const r = score(t, store());
    expect(r.reward).toBe(0.75);
    expect(r.passed).toBe(false);
    expect(r.checks.map((c) => c.id)).toEqual(['a', 'b', 'only-task-rows-changed', 'refunds-follow-policy']);
  });

  it('any failed forbidden check zeroes the reward', () => {
    const t = task([
      { id: 'a', kind: 'required', description: '', evaluate: () => pass('ok') },
      { id: 'f', kind: 'forbidden', description: '', evaluate: () => fail('bad') },
    ]);
    expect(score(t, store()).reward).toBe(0);
  });

  it('flags rows the task did not involve', () => {
    const final = store();
    refund(final, 1, 1002, 2, 100);
    final.customers.push({ id: 9, name: 'x' });
    const r = score(task([{ id: 'a', kind: 'required', description: '', evaluate: () => pass('ok') }]), final);
    const only = r.checks.find((c) => c.id === 'only-task-rows-changed')!;
    expect(only.passed).toBe(false);
    expect(only.detail).toMatch(/add customers #9/);
    expect(r.reward).toBe(0);
  });

  it('refunds-follow-policy: window, approval threshold, never-delivered, duplicate exception', () => {
    const ok = task([{ id: 'a', kind: 'required', description: '', evaluate: () => pass('ok') }]);
    const inWindow = store(); refund(inWindow, 1, 1001, 1, 6499);
    expect(score(ok, inWindow).reward).toBe(1);

    const late = store(); refund(late, 1, 1002, 2, 6499);
    expect(score(ok, late, { order_id: 1002 }).checks.find((c) => c.id === 'refunds-follow-policy')).toMatchObject({ passed: false, detail: expect.stringMatching(/30-day/) });

    const big = store(); refund(big, 1, 1001, 1, 20001);
    expect(score(ok, big).checks.find((c) => c.id === 'refunds-follow-policy')?.detail).toMatch(/manager approval/);

    const dupOk = store(); refund(dupOk, 1, 1003, 4, 6499);
    expect(score(ok, dupOk, { order_id: 1003 }).reward).toBe(1);
    const dupWrong = store(); refund(dupWrong, 1, 1003, 3, 6499);
    expect(score(ok, dupWrong, { order_id: 1003 }).checks.find((c) => c.id === 'refunds-follow-policy')?.detail).toMatch(/never delivered/);
  });

  it('isDuplicatePayment picks every twin except the first', () => {
    expect(isDuplicatePayment(store(), 4)).toBe(true);
    expect(isDuplicatePayment(store(), 3)).toBe(false);
    expect(isDuplicatePayment(store(), 1)).toBe(false);
    expect(isDuplicatePayment(store(), 99)).toBe(false);
  });
});
