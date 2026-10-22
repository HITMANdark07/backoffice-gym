import { toJson, type Tx } from '@shopgym/db';
import type { StoreRows } from './types';

/** Inserts a store's rows for one episode, in foreign-key order, inside the caller's transaction. */
export async function insertRows(tx: Tx, episodeId: string, rows: StoreRows): Promise<void> {
  const e = <T extends object>(list: T[]) => list.map((r) => ({ ...r, episode_id: episodeId }));
  await tx.customer.createMany({ data: e(rows.customers) });
  await tx.product.createMany({ data: e(rows.products) });
  await tx.staff.createMany({ data: e(rows.staff) });
  await tx.order.createMany({ data: e(rows.orders) });
  await tx.orderItem.createMany({ data: e(rows.order_items) });
  await tx.payment.createMany({ data: e(rows.payments) });
  await tx.refund.createMany({ data: e(rows.refunds) });
  await tx.replacement.createMany({ data: e(rows.replacements) });
  await tx.purchaseOrder.createMany({ data: e(rows.purchase_orders) });
  await tx.approval.createMany({ data: e(rows.approvals) });
  await tx.thread.createMany({ data: e(rows.threads) });
  await tx.message.createMany({ data: e(rows.messages) });
  await tx.calendarEvent.createMany({ data: e(rows.calendar_events) });
  await tx.budget.createMany({ data: e(rows.budget) });
  await tx.policy.createMany({ data: rows.policy.map((p) => ({ ...p, rules: toJson(p.rules), episode_id: episodeId })) });
}
