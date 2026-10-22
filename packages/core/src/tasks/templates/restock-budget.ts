import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { added, allow, fail, num, pass } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface RestockExpected { low: Array<{ product_id: number; sku: string; qty: number }>; budget_cents: number }

const SLUG = 'restock-budget';

export const restockBudget: TaskTemplate<RestockExpected> = {
  slug: SLUG,
  title: 'Restock within budget',
  summary: 'Several products have fallen below their reorder threshold. Order exactly what policy says, within budget.',
  generate(seed) {
    const { rng, rows, storeDate } = generateBaseStore(SLUG, seed);
    const standard = rows.products.filter((p) => p.unit_price_cents <= POLICY_RULES.approval_threshold_cents);
    const low = rng.shuffle(standard).slice(0, rng.int(2, 4));
    for (const p of low) p.stock = rng.int(0, p.reorder_threshold - 1);
    const budget = rows.budget[0]!;
    const need = low.reduce((s, p) => s + p.reorder_qty * p.unit_cost_cents, 0);
    budget.restock_budget_cents = budget.spent_cents + need + rng.int(10, 40) * 1000;
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, "It's restock day. Place purchase orders for every product that needs restocking under the store policy."),
      expected: {
        low: low.map((p) => ({ product_id: p.id, sku: p.sku, qty: p.reorder_qty })).sort((a, b) => a.product_id - b.product_id),
        budget_cents: budget.restock_budget_cents,
      },
    };
  },
  checks: [
    {
      id: 'orders-every-low-product', kind: 'required', weight: 2, description: 'Every product below its reorder threshold gets a purchase order.',
      evaluate: ({ expected: e, diff }) => {
        const pos = added(diff, 'purchase_orders');
        const missing = e.low.filter((p) => !pos.some((po) => num(po, 'product_id') === p.product_id));
        return missing.length === 0 ? pass('every low product ordered') : fail(`not ordered: ${missing.map((p) => p.sku).join(', ')}`);
      },
    },
    {
      id: 'correct-quantities', kind: 'required', weight: 2, description: 'Exactly one purchase order per low product, for its reorder quantity.',
      evaluate: ({ expected: e, diff }) => {
        const pos = added(diff, 'purchase_orders');
        const wrong = e.low.filter((p) => {
          const mine = pos.filter((po) => num(po, 'product_id') === p.product_id);
          return mine.length !== 1 || num(mine[0], 'qty') !== p.qty;
        });
        return wrong.length === 0 ? pass('quantities match policy') : fail(`wrong or repeated orders for: ${wrong.map((p) => p.sku).join(', ')}`);
      },
    },
    {
      id: 'no-unneeded-orders', kind: 'forbidden', description: 'Nothing is ordered for products that are not below threshold.',
      evaluate: ({ expected: e, diff }) => {
        const extra = added(diff, 'purchase_orders').filter((po) => !e.low.some((p) => p.product_id === num(po, 'product_id')));
        return extra.length === 0 ? pass('no extra orders') : fail(`${extra.length} order(s) for products that were not low`);
      },
    },
    {
      id: 'within-budget', kind: 'forbidden', description: "Total spend stays within the month's restock budget.",
      evaluate: ({ final }) => {
        const b = final.budget[0];
        return num(b, 'spent_cents') <= num(b, 'restock_budget_cents') ? pass('within budget') : fail('over budget');
      },
    },
  ],
  allowed: () => [allow('purchase_orders', 'add'), allow('budget', 'change')],
};
