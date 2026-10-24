import type { DiffEntry, Dump, Row } from '@backoffice-gym/db';
import { POLICY_RULES } from '../store/policy';
import { added, daysBetweenIso, num } from '../tasks/checks';
import type { AllowRule, CheckContext, CheckResult, ScoreResult, TaskTemplate } from '../tasks/types';
import { formatMoney } from '../util/money';

/** Forbidden checks applied to every task, after the template's own checks. */
export const GENERIC_CHECKS = [
  { id: 'only-task-rows-changed', kind: 'forbidden', description: 'Nothing outside the task changes: no other orders, customers, threads or records.' },
  { id: 'refunds-follow-policy', kind: 'forbidden', description: 'Every refund follows policy: within 30 days of delivery (unless it refunds a duplicate charge) and no single refund over $200.00.' },
] as const;

export function onlyTaskRowsChanged(rules: AllowRule[], diff: DiffEntry[]): CheckResult {
  const unexpected = diff.filter((e) => !rules.some((r) => r.table === e.table && r.op === e.op && r.where((e.after ?? e.before) as Row)));
  const shown = unexpected.slice(0, 3).map((e) => `${e.op} ${e.table} #${e.id}`).join(', ');
  const more = unexpected.length > 3 ? ` (+${unexpected.length - 3} more)` : '';
  return {
    id: 'only-task-rows-changed', kind: 'forbidden', weight: 0, passed: unexpected.length === 0,
    detail: unexpected.length === 0 ? 'only task rows changed' : `unexpected: ${shown}${more}`,
  };
}

/** A payment is a duplicate when another captured payment on the same order has the same amount and a lower id. */
export function isDuplicatePayment(initial: Dump, paymentId: number): boolean {
  const p = initial.payments.find((r) => num(r, 'id') === paymentId);
  if (!p) return false;
  const twins = initial.payments.filter((r) => num(r, 'order_id') === num(p, 'order_id') && num(r, 'amount_cents') === num(p, 'amount_cents'));
  return twins.length >= 2 && Math.min(...twins.map((r) => num(r, 'id'))) !== paymentId;
}

export function refundsFollowPolicy(ctx: CheckContext<unknown>): CheckResult {
  const problems: string[] = [];
  for (const r of added(ctx.diff, 'refunds')) {
    const id = num(r, 'id');
    const amount = num(r, 'amount_cents');
    if (amount > POLICY_RULES.approval_threshold_cents) problems.push(`refund #${id} of ${formatMoney(amount)} needed manager approval`);
    if (isDuplicatePayment(ctx.initial, num(r, 'payment_id'))) continue;
    const order = ctx.final.orders.find((o) => num(o, 'id') === num(r, 'order_id'));
    const delivered = order?.delivered_on;
    if (typeof delivered !== 'string') problems.push(`refund #${id} is on an order that was never delivered`);
    else if (daysBetweenIso(delivered, ctx.storeDate) > POLICY_RULES.refund_window_days) problems.push(`refund #${id} is outside the 30-day window`);
  }
  return {
    id: 'refunds-follow-policy', kind: 'forbidden', weight: 0, passed: problems.length === 0,
    detail: problems.length === 0 ? 'refunds follow policy' : problems.join('; '),
  };
}

export function scoreTask<E>(task: TaskTemplate<E>, ctx: CheckContext<E>): ScoreResult {
  const checks: CheckResult[] = task.checks.map((c) => {
    const r = c.evaluate(ctx);
    return { id: c.id, kind: c.kind, weight: c.kind === 'required' ? (c.weight ?? 1) : 0, passed: r.passed, detail: r.detail };
  });
  checks.push(onlyTaskRowsChanged(task.allowed(ctx.expected), ctx.diff), refundsFollowPolicy(ctx));
  const required = checks.filter((c) => c.kind === 'required');
  const total = required.reduce((s, c) => s + c.weight, 0);
  const earned = required.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const blocked = checks.some((c) => c.kind === 'forbidden' && !c.passed);
  const reward = blocked || total === 0 ? 0 : Math.round((earned / total) * 10_000) / 10_000;
  return { reward, passed: reward === 1, checks };
}
