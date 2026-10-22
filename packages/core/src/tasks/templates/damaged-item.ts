import { addOrder, addThread, randomAddress } from '../../store/build';
import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { formatMoney } from '../../util/money';
import { addDays } from '../../util/time';
import { added, allow, fail, num, pass, replyMentionsOrder, replyRules } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface DamagedItemExpected {
  customer_id: number; order_id: number; thread_id: number; product_id: number; sku: string; in_stock: boolean; refund_cents: number;
}

const SLUG = 'damaged-item';

export const damagedItem: TaskTemplate<DamagedItemExpected> = {
  slug: SLUG,
  title: 'Damaged item',
  summary: 'A customer reports an item that arrived broken. Replace it if it is in stock, otherwise refund it, and reply.',
  generate(seed) {
    const { rng, faker, rows, storeDate } = generateBaseStore(SLUG, seed);
    const customer = rng.pick(rows.customers);
    const product = rng.pick(rows.products.filter((p) => p.unit_price_cents <= POLICY_RULES.approval_threshold_cents));
    const inStock = rng.chance(0.5);
    product.stock = inStock ? rng.int(3, 10) : 0;
    const order = addOrder(rows, {
      customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'delivered',
      deliveredOn: addDays(storeDate, -rng.int(2, 20)), address: randomAddress(faker),
    });
    const thread = addThread(rows, {
      customerId: customer.id,
      subject: `Order #${order.id} arrived damaged`,
      body: `Hi, my ${product.name.toLowerCase()} from order #${order.id} arrived broken. The box was crushed and it's cracked right through. What can you do?`,
    });
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, `Handle the open support thread from ${customer.name}.`),
      expected: { customer_id: customer.id, order_id: order.id, thread_id: thread.id, product_id: product.id, sku: product.sku, in_stock: inStock, refund_cents: product.unit_price_cents },
    };
  },
  checks: [
    {
      id: 'correct-remedy', kind: 'required', weight: 3,
      description: 'A replacement if the item is in stock; otherwise one refund of exactly the item price.',
      evaluate: ({ expected: e, diff }) => {
        const refunds = added(diff, 'refunds').filter((r) => num(r, 'order_id') === e.order_id);
        const repl = added(diff, 'replacements').filter((r) => num(r, 'order_id') === e.order_id);
        if (e.in_stock) {
          const ok = repl.length === 1 && num(repl[0], 'product_id') === e.product_id && num(repl[0], 'qty') === 1 && refunds.length === 0;
          return ok ? pass('replacement sent') : fail(`expected one replacement of ${e.sku}; got ${repl.length} replacement(s) and ${refunds.length} refund(s)`);
        }
        const total = refunds.reduce((s, r) => s + num(r, 'amount_cents'), 0);
        const ok = refunds.length === 1 && total === e.refund_cents && repl.length === 0;
        return ok ? pass(`refunded ${formatMoney(total)}`) : fail(`expected one refund of ${formatMoney(e.refund_cents)}; got ${refunds.length} refund(s) totalling ${formatMoney(total)}`);
      },
    },
    replyMentionsOrder<DamagedItemExpected>(),
    {
      id: 'no-refund-when-in-stock', kind: 'forbidden', description: 'No refund when a replacement is available.',
      evaluate: ({ expected: e, diff }) => (!e.in_stock || added(diff, 'refunds').length === 0 ? pass('ok') : fail('refunded an item that could be replaced')),
    },
  ],
  allowed: (e) => [
    allow('refunds', 'add', (r) => num(r, 'order_id') === e.order_id),
    allow('replacements', 'add', (r) => num(r, 'order_id') === e.order_id),
    allow('payments', 'change', (r) => num(r, 'order_id') === e.order_id),
    allow('orders', 'change', (r) => num(r, 'id') === e.order_id),
    allow('products', 'change', (r) => num(r, 'id') === e.product_id),
    ...replyRules(e.thread_id),
  ],
};
