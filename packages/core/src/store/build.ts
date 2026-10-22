import type { Faker } from '@faker-js/faker';
import type { Rng } from '../util/rng';
import { addDays, addMinutes } from '../util/time';
import type { CalendarEventRow, CustomerRow, OrderRow, StoreRows, ThreadRow } from './types';

/** Next id after the largest in `list` (or `start` when empty). */
export const nextId = (list: ReadonlyArray<{ id: number }>, start = 1): number =>
  list.reduce((max, r) => Math.max(max, r.id), start - 1) + 1;

export const personName = (faker: Faker): string => `${faker.person.firstName()} ${faker.person.lastName()}`;

export const randomAddress = (faker: Faker): string =>
  `${faker.location.buildingNumber()} ${faker.location.street()}, ${faker.location.city()} ${faker.location.zipCode('######')}`;

const emailPart = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

export function makeCustomer(rows: StoreRows, faker: Faker, rng: Rng, storeDate: Date): CustomerRow {
  const id = nextId(rows.customers);
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  const customer: CustomerRow = {
    id,
    name: `${first} ${last}`,
    email: `${emailPart(first)}.${emailPart(last)}${id}@example.com`,
    tier: rng.chance(0.2) ? 'vip' : 'standard',
    created_on: addDays(storeDate, -rng.int(60, 700)),
  };
  rows.customers.push(customer);
  return customer;
}

export interface OrderSpec {
  customerId: number;
  items: Array<{ productId: number; qty: number }>;
  status: 'processing' | 'shipped' | 'delivered';
  /** Required for processing and shipped orders. */
  placedOn?: Date;
  /** Required for delivered orders; placed 5 days and shipped 3 days before it. */
  deliveredOn?: Date;
  address: string;
}

/** Adds an order with its items and one captured payment for the full total. */
export function addOrder(rows: StoreRows, spec: OrderSpec): OrderRow {
  const id = nextId(rows.orders, 1001);
  let placed: Date;
  let shipped: Date | null = null;
  let delivered: Date | null = null;
  if (spec.status === 'delivered') {
    if (!spec.deliveredOn) throw new Error('delivered orders need deliveredOn');
    delivered = spec.deliveredOn;
    shipped = addDays(delivered, -3);
    placed = addDays(delivered, -5);
  } else {
    if (!spec.placedOn) throw new Error(`${spec.status} orders need placedOn`);
    placed = spec.placedOn;
    if (spec.status === 'shipped') shipped = addDays(placed, 2);
  }
  let total = 0;
  for (const item of spec.items) {
    const product = rows.products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`no product ${item.productId}`);
    total += product.unit_price_cents * item.qty;
    rows.order_items.push({ id: nextId(rows.order_items), order_id: id, product_id: product.id, qty: item.qty, unit_price_cents: product.unit_price_cents });
  }
  const order: OrderRow = {
    id, customer_id: spec.customerId, status: spec.status, placed_on: placed, shipped_on: shipped,
    delivered_on: delivered, shipping_address: spec.address, total_cents: total,
  };
  rows.orders.push(order);
  rows.payments.push({ id: nextId(rows.payments), order_id: id, amount_cents: total, captured_on: placed, status: 'captured' });
  return order;
}

export function addThread(
  rows: StoreRows,
  spec: { customerId: number; subject: string; body: string; status?: 'open' | 'replied'; reply?: string },
): ThreadRow {
  const thread: ThreadRow = { id: nextId(rows.threads), customer_id: spec.customerId, subject: spec.subject, status: spec.status ?? 'open' };
  rows.threads.push(thread);
  rows.messages.push({ id: nextId(rows.messages), thread_id: thread.id, author: 'customer', body: spec.body, sent_step: 0 });
  if (spec.reply) rows.messages.push({ id: nextId(rows.messages), thread_id: thread.id, author: 'staff', body: spec.reply, sent_step: 0 });
  return thread;
}

export function addEvent(
  rows: StoreRows,
  spec: { staffId: number; title: string; startsAt: Date; minutes: number; customerId?: number },
): CalendarEventRow {
  const event: CalendarEventRow = {
    id: nextId(rows.calendar_events), staff_id: spec.staffId, title: spec.title, starts_at: spec.startsAt,
    ends_at: addMinutes(spec.startsAt, spec.minutes), customer_id: spec.customerId ?? null, created_step: 0,
  };
  rows.calendar_events.push(event);
  return event;
}
