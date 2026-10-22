import { addOrder, addThread, nextId, randomAddress } from '../../store/build';
import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { formatMoney } from '../../util/money';
import { addDays, daysBetween } from '../../util/time';
import { added, allow, fail, num, pass, replyMentionsOrder, replyRules } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface DuplicateExpected {
  customer_id: number; order_id: number; thread_id: number; original_payment_id: number; duplicate_payment_id: number;
  amount_cents: number; days_since_delivery: number | null;
}

const SLUG = 'duplicate-charge';

export const duplicateCharge: TaskTemplate<DuplicateExpected> = {
  slug: SLUG,
  title: 'Charged twice',
  summary: 'A customer was charged twice for one order. Refund the duplicate payment, never the original.',
  generate(seed) {
    const { rng, faker, rows, storeDate } = generateBaseStore(SLUG, seed);
    const customer = rng.pick(rows.customers);
    const product = rng.pick(rows.products.filter((p) => p.unit_price_cents <= POLICY_RULES.approval_threshold_cents));
    const delivered = rng.chance(0.5);
    const order = delivered
      ? addOrder(rows, { customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'delivered', deliveredOn: addDays(storeDate, -rng.int(1, 45)), address: randomAddress(faker) })
      : addOrder(rows, { customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'processing', placedOn: addDays(storeDate, -rng.int(0, 2)), address: randomAddress(faker) });
    const original = rows.payments.find((p) => p.order_id === order.id)!;
    const duplicate = { id: nextId(rows.payments), order_id: order.id, amount_cents: original.amount_cents, captured_on: original.captured_on, status: 'captured' as const };
    rows.payments.push(duplicate);
    const thread = addThread(rows, {
      customerId: customer.id,
      subject: `Charged twice for order #${order.id}`,
      body: `Hi, I was charged twice for order #${order.id}: I can see two payments of ${formatMoney(original.amount_cents)} on my card. Can you please fix this?`,
    });
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, `Handle the open support thread from ${customer.name}.`),
      expected: {
        customer_id: customer.id, order_id: order.id, thread_id: thread.id, original_payment_id: original.id, duplicate_payment_id: duplicate.id,
        amount_cents: original.amount_cents, days_since_delivery: order.delivered_on ? daysBetween(order.delivered_on, storeDate) : null,
      },
    };
  },
  checks: [
    {
      id: 'refunds-duplicate', kind: 'required', weight: 3, description: 'One refund of the full duplicate payment, on that payment.',
      evaluate: ({ expected: e, diff }) => {
        const refunds = added(diff, 'refunds').filter((r) => num(r, 'order_id') === e.order_id);
        return refunds.length === 1 && num(refunds[0], 'payment_id') === e.duplicate_payment_id && num(refunds[0], 'amount_cents') === e.amount_cents
          ? pass('duplicate refunded')
          : fail(`expected one refund of ${formatMoney(e.amount_cents)} on the duplicate payment; got ${refunds.length} refund(s)`);
      },
    },
    replyMentionsOrder<DuplicateExpected>(),
    {
      id: 'original-untouched', kind: 'forbidden', description: 'The original payment is never refunded.',
      evaluate: ({ expected: e, diff }) =>
        added(diff, 'refunds').some((r) => num(r, 'payment_id') === e.original_payment_id) ? fail('refunded the original payment') : pass('original untouched'),
    },
  ],
  allowed: (e) => [
    allow('refunds', 'add', (r) => num(r, 'order_id') === e.order_id),
    allow('payments', 'change', (r) => num(r, 'id') === e.duplicate_payment_id),
    allow('orders', 'change', (r) => num(r, 'id') === e.order_id),
    ...replyRules(e.thread_id),
  ],
};
