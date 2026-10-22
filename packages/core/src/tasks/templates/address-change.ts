import { addOrder, addThread, randomAddress } from '../../store/build';
import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { addDays } from '../../util/time';
import { agentReplies, allow, fail, num, pass, replyMentionsOrder, replyRules, str } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface AddressExpected { customer_id: number; order_id: number; thread_id: number; old_address: string; new_address: string; shipped: boolean }

const SLUG = 'address-change';
const SHIPPED_RE = /\b(already\s+)?(shipped|dispatched|in transit|on (its|the) way)\b/i;
const norm = (s: string): string => s.toLowerCase().replace(/[\s,.]+/g, ' ').trim();

export const addressChange: TaskTemplate<AddressExpected> = {
  slug: SLUG,
  title: 'Address change',
  summary: 'A customer moved and wants an order sent to a new address. Possible only before it ships.',
  generate(seed) {
    const { rng, faker, rows, storeDate } = generateBaseStore(SLUG, seed);
    const customer = rng.pick(rows.customers);
    const product = rng.pick(rows.products.filter((p) => p.unit_price_cents <= POLICY_RULES.approval_threshold_cents));
    const shipped = rng.chance(0.4);
    const oldAddress = randomAddress(faker);
    const order = shipped
      ? addOrder(rows, { customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'shipped', placedOn: addDays(storeDate, -rng.int(3, 5)), address: oldAddress })
      : addOrder(rows, { customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'processing', placedOn: addDays(storeDate, -rng.int(0, 2)), address: oldAddress });
    let newAddress = randomAddress(faker);
    while (norm(newAddress) === norm(oldAddress)) newAddress = randomAddress(faker);
    const thread = addThread(rows, {
      customerId: customer.id,
      subject: `New address for order #${order.id}`,
      body: `Hi! I've just moved. Could you please send order #${order.id} to my new address instead?\n\n${newAddress}\n\nThank you!`,
    });
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, `Handle the open support thread from ${customer.name}.`),
      expected: { customer_id: customer.id, order_id: order.id, thread_id: thread.id, old_address: oldAddress, new_address: newAddress, shipped },
    };
  },
  checks: [
    {
      id: 'address-outcome', kind: 'required', weight: 3,
      description: 'Before shipping, the address is updated exactly; after shipping, it is left alone and the reply explains the order has shipped.',
      evaluate: ({ expected: e, final, diff }) => {
        const order = final.orders.find((o) => num(o, 'id') === e.order_id);
        const address = str(order, 'shipping_address');
        if (!e.shipped) return norm(address) === norm(e.new_address) ? pass('address updated') : fail('address not updated to the new one');
        if (address !== e.old_address) return fail('address changed on a shipped order');
        return agentReplies(diff, e.thread_id).some((b) => SHIPPED_RE.test(b)) ? pass('explained that it shipped') : fail('reply does not explain the order has shipped');
      },
    },
    replyMentionsOrder<AddressExpected>(),
  ],
  allowed: (e) => [allow('orders', 'change', (r) => num(r, 'id') === e.order_id), ...replyRules(e.thread_id)],
};
