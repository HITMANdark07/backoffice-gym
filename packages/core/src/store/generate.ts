import { base, en, en_IN, Faker } from '@faker-js/faker';
import { fnv1a32, taskRng, type Rng } from '../util/rng';
import { addDays, at, dateOnly, isoDate } from '../util/time';
import { addEvent, addOrder, addThread, makeCustomer, personName, randomAddress } from './build';
import { CATALOG } from './catalog';
import { POLICY_RULES, POLICY_TEXT } from './policy';
import type { StoreRows } from './types';

export const BASE_START = '2026-03-02';
const EVENT_TITLES = ['Team stand-up', 'Supplier call', 'Inventory review', '1:1', 'Returns triage'] as const;

export interface BaseStore {
  rng: Rng;
  faker: Faker;
  rows: StoreRows;
  storeDate: Date;
}

export function createFaker(seed: number): Faker {
  const faker = new Faker({ locale: [en_IN, en, base] });
  faker.seed(seed);
  return faker;
}

export function emptyRows(): StoreRows {
  return {
    customers: [], products: [], staff: [], orders: [], order_items: [], payments: [], refunds: [], replacements: [],
    purchase_orders: [], approvals: [], threads: [], messages: [], calendar_events: [], budget: [], policy: [],
  };
}

/**
 * The shared background store for a task: staff, catalogue, 8 customers, 12 orders, two answered threads,
 * three days of calendar and the month's budget. Templates add their scenario on top using the returned rng/faker.
 */
export function generateBaseStore(slug: string, seed: number): BaseStore {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new RangeError(`seed must be a non-negative integer, got ${seed}`);
  const rng = taskRng(slug, seed);
  const faker = createFaker(fnv1a32(`faker:${slug}:${seed}`));
  const storeDate = addDays(dateOnly(BASE_START), rng.int(0, 27));
  const rows = emptyRows();

  rows.staff.push(
    { id: 1, name: personName(faker), role: 'support', on_duty: true },
    { id: 2, name: personName(faker), role: 'support', on_duty: rng.chance(0.5) },
    { id: 3, name: personName(faker), role: 'manager', on_duty: true },
    { id: 4, name: personName(faker), role: 'buyer', on_duty: true },
  );

  CATALOG.forEach((p, i) =>
    rows.products.push({
      id: i + 1, sku: p.sku, name: p.name, unit_price_cents: p.price_cents, unit_cost_cents: p.cost_cents,
      stock: rng.int(8, 40), reorder_threshold: 5, reorder_qty: 20, supplier: p.supplier,
    }),
  );

  for (let i = 0; i < 8; i++) makeCustomer(rows, faker, rng, storeDate);

  const standard = rows.products.filter((p) => p.unit_price_cents <= POLICY_RULES.approval_threshold_cents);
  for (let i = 0; i < 12; i++) {
    const customer = rng.pick(rows.customers);
    const age = rng.int(1, 90);
    const items = rng.shuffle(standard).slice(0, rng.int(1, 2)).map((p) => ({ productId: p.id, qty: rng.int(1, 2) }));
    const address = randomAddress(faker);
    if (age >= 8) addOrder(rows, { customerId: customer.id, items, status: 'delivered', deliveredOn: addDays(storeDate, -(age - 5)), address });
    else if (age >= 3) addOrder(rows, { customerId: customer.id, items, status: 'shipped', placedOn: addDays(storeDate, -age), address });
    else addOrder(rows, { customerId: customer.id, items, status: 'processing', placedOn: addDays(storeDate, -age), address });
  }

  addThread(rows, {
    customerId: rng.pick(rows.customers).id, subject: 'Gift wrapping', body: 'Hi, do you offer gift wrapping?',
    status: 'replied', reply: 'Yes! Add a note at checkout and we will gift-wrap it for free.',
  });
  addThread(rows, {
    customerId: rng.pick(rows.customers).id, subject: 'Delivery times', body: 'How long does delivery usually take?',
    status: 'replied', reply: 'Most orders arrive within 5 days of shipping.',
  });

  for (const staffId of [1, 2, 3]) {
    for (let d = 0; d <= 2; d++) {
      const count = rng.int(1, 2);
      for (let k = 0; k < count; k++) {
        addEvent(rows, {
          staffId, title: rng.pick(EVENT_TITLES), startsAt: at(addDays(storeDate, d), rng.int(9, 15), rng.pick([0, 30])), minutes: rng.pick([30, 60]),
        });
      }
    }
  }

  rows.budget.push({ id: 1, month: isoDate(storeDate).slice(0, 7), restock_budget_cents: 150_000, spent_cents: rng.int(0, 40) * 500 });
  rows.policy.push({ id: 1, text: POLICY_TEXT, rules: { ...POLICY_RULES, business_hours: { ...POLICY_RULES.business_hours } } });

  return { rng, faker, rows, storeDate };
}
