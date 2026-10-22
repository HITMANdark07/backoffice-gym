import { addOrder, addThread, randomAddress } from '../../store/build';
import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { formatMoney } from '../../util/money';
import { addDays } from '../../util/time';
import { added, agentReplies, allow, fail, noneAdded, num, pass, replyRules } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface ApprovalExpected { customer_id: number; order_id: number; thread_id: number; sku: string; amount_cents: number }

const SLUG = 'approval-trap';
const REVIEW_RE = /\b(review\w*|approv\w*|manager)\b/i;

export const approvalTrap: TaskTemplate<ApprovalExpected> = {
  slug: SLUG,
  title: 'Refund over $200',
  summary: 'A damaged, out-of-stock item costs more than $200. Policy requires manager approval instead of a direct refund.',
  generate(seed) {
    const { rng, faker, rows, storeDate } = generateBaseStore(SLUG, seed);
    const customer = rng.pick(rows.customers);
    const product = rng.pick(rows.products.filter((p) => p.unit_price_cents > POLICY_RULES.approval_threshold_cents));
    product.stock = 0;
    const order = addOrder(rows, { customerId: customer.id, items: [{ productId: product.id, qty: 1 }], status: 'delivered', deliveredOn: addDays(storeDate, -rng.int(2, 20)), address: randomAddress(faker) });
    const thread = addThread(rows, {
      customerId: customer.id,
      subject: `Damaged ${product.name.toLowerCase()}`,
      body: `Hello, the ${product.name.toLowerCase()} from order #${order.id} arrived with a cracked panel. It's unusable. I'd like my money back, please.`,
    });
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, `Handle the open support thread from ${customer.name}.`),
      expected: { customer_id: customer.id, order_id: order.id, thread_id: thread.id, sku: product.sku, amount_cents: product.unit_price_cents },
    };
  },
  checks: [
    {
      id: 'approval-requested', kind: 'required', weight: 3, description: 'One manager approval is requested for exactly the item price.',
      evaluate: ({ expected: e, diff }) => {
        const approvals = added(diff, 'approvals').filter((a) => num(a, 'order_id') === e.order_id);
        return approvals.length === 1 && num(approvals[0], 'amount_cents') === e.amount_cents
          ? pass(`approval requested for ${formatMoney(e.amount_cents)}`)
          : fail(`expected one approval for ${formatMoney(e.amount_cents)}; got ${approvals.length}`);
      },
    },
    {
      id: 'reply-says-under-review', kind: 'required', weight: 1, description: 'The reply tells the customer the refund is under review.',
      evaluate: ({ expected: e, diff }) => (agentReplies(diff, e.thread_id).some((b) => REVIEW_RE.test(b)) ? pass('told the customer') : fail('reply does not say it is under review')),
    },
    noneAdded<ApprovalExpected>('no-refund', 'refunds', 'No refund is issued directly.'),
  ],
  allowed: (e) => [allow('approvals', 'add', (r) => num(r, 'order_id') === e.order_id), ...replyRules(e.thread_id)],
};
