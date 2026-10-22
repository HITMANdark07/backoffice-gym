import { z } from 'zod';
import { ToolError } from '../errors';
import { dollars, formatMoney, toCents } from '../util/money';
import { addMinutes, formatWallTime, isoDate, parseWallTime } from '../util/time';
import { nextRowId } from './ids';
import { defineTool } from './types';

const id = z.number().int().positive();
const amount = z.number().positive();
const reason = z.string().trim().min(1).max(500);

function cents(value: number): number {
  const c = toCents(value);
  if (c === null) throw new ToolError('amount must be a positive dollar amount with at most 2 decimals, like 64.99');
  return c;
}

export const replyToThread = defineTool({
  name: 'reply_to_thread',
  kind: 'act',
  description: 'Send a reply to the customer on a support thread.',
  input: z.object({ thread_id: id, body: z.string().trim().min(1).max(4000) }).strict(),
  async run({ tx, episodeId, step }, a) {
    const thread = await tx.thread.findFirst({ where: { episode_id: episodeId, id: a.thread_id } });
    if (!thread) throw new ToolError(`thread ${a.thread_id} not found`);
    const messageId = await nextRowId(tx, 'messages', episodeId);
    await tx.message.create({ data: { episode_id: episodeId, id: messageId, thread_id: thread.id, author: 'agent', body: a.body, sent_step: step } });
    await tx.thread.updateMany({ where: { episode_id: episodeId, id: thread.id }, data: { status: 'replied' } });
    return { message_id: messageId, thread_id: thread.id, thread_status: 'replied' };
  },
});

export const issueRefund = defineTool({
  name: 'issue_refund',
  kind: 'act',
  description: 'Refund money on an order. Without payment_id, refunds the first payment with enough left to refund.',
  input: z.object({ order_id: id, amount, reason, payment_id: id.optional() }).strict(),
  async run({ tx, episodeId, step }, a) {
    const amountCents = cents(a.amount);
    const order = await tx.order.findFirst({
      where: { episode_id: episodeId, id: a.order_id },
      include: { payments: { orderBy: { id: 'asc' } }, refunds: true },
    });
    if (!order) throw new ToolError(`order ${a.order_id} not found`);
    const refundedOn = (paymentId: number) => order.refunds.filter((r) => r.payment_id === paymentId).reduce((s, r) => s + r.amount_cents, 0);
    const left = (p: { id: number; amount_cents: number }) => p.amount_cents - refundedOn(p.id);

    const payment = order.payments.find((p) => (a.payment_id === undefined ? left(p) >= amountCents : p.id === a.payment_id));
    if (a.payment_id !== undefined && !payment) throw new ToolError(`payment ${a.payment_id} does not belong to order ${order.id}`);
    if (!payment) throw new ToolError(`a refund of ${formatMoney(amountCents)} exceeds what is left to refund on order ${order.id}`);
    if (amountCents > left(payment)) throw new ToolError(`a refund of ${formatMoney(amountCents)} exceeds the ${formatMoney(left(payment))} left on payment ${payment.id}`);

    const refundId = await nextRowId(tx, 'refunds', episodeId);
    await tx.refund.create({ data: { episode_id: episodeId, id: refundId, order_id: order.id, payment_id: payment.id, amount_cents: amountCents, reason: a.reason, created_step: step } });
    if (refundedOn(payment.id) + amountCents >= payment.amount_cents) {
      await tx.payment.updateMany({ where: { episode_id: episodeId, id: payment.id }, data: { status: 'refunded' } });
    }
    const paid = order.payments.reduce((s, p) => s + p.amount_cents, 0);
    const refunded = order.refunds.reduce((s, r) => s + r.amount_cents, 0) + amountCents;
    const net = paid - refunded;
    const status = net <= 0 ? 'refunded' : net < order.total_cents ? 'partially_refunded' : order.status;
    if (status !== order.status) await tx.order.updateMany({ where: { episode_id: episodeId, id: order.id }, data: { status } });
    return { refund_id: refundId, order_id: order.id, payment_id: payment.id, amount: dollars(amountCents), order_status: status };
  },
});

export const createReplacement = defineTool({
  name: 'create_replacement',
  kind: 'act',
  description: 'Ship a replacement for an item on an order. Takes it from stock.',
  input: z.object({ order_id: id, sku: z.string().trim().min(1), qty: z.number().int().min(1).max(10) }).strict(),
  async run({ tx, episodeId, step }, a) {
    const order = await tx.order.findFirst({ where: { episode_id: episodeId, id: a.order_id }, include: { items: { include: { product: true } } } });
    if (!order) throw new ToolError(`order ${a.order_id} not found`);
    const item = order.items.find((i) => i.product.sku === a.sku);
    if (!item) throw new ToolError(`order ${order.id} does not contain ${a.sku}`);
    if (a.qty > item.qty) throw new ToolError(`order ${order.id} has only ${item.qty} × ${a.sku}`);
    if (item.product.stock < a.qty) throw new ToolError(`${a.sku} is out of stock (stock ${item.product.stock})`);
    await tx.product.updateMany({ where: { episode_id: episodeId, id: item.product.id }, data: { stock: { decrement: a.qty } } });
    const replacementId = await nextRowId(tx, 'replacements', episodeId);
    await tx.replacement.create({ data: { episode_id: episodeId, id: replacementId, order_id: order.id, product_id: item.product.id, qty: a.qty, created_step: step } });
    return { replacement_id: replacementId, order_id: order.id, sku: a.sku, qty: a.qty, stock_left: item.product.stock - a.qty };
  },
});

export const updateShippingAddress = defineTool({
  name: 'update_shipping_address',
  kind: 'act',
  description: "Change an order's shipping address.",
  input: z.object({ order_id: id, address: z.string().trim().min(5).max(300) }).strict(),
  async run({ tx, episodeId }, a) {
    const order = await tx.order.findFirst({ where: { episode_id: episodeId, id: a.order_id } });
    if (!order) throw new ToolError(`order ${a.order_id} not found`);
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new ToolError(`order ${order.id} is ${order.status}, so its address can no longer be changed`);
    }
    await tx.order.updateMany({ where: { episode_id: episodeId, id: order.id }, data: { shipping_address: a.address } });
    return { order_id: order.id, shipping_address: a.address };
  },
});

export const createPurchaseOrder = defineTool({
  name: 'create_purchase_order',
  kind: 'act',
  description: "Order stock from a product's supplier. The cost is added to this month's restock spend.",
  input: z.object({ sku: z.string().trim().min(1), qty: z.number().int().min(1).max(1000) }).strict(),
  async run({ tx, episodeId, step, storeDate }, a) {
    const product = await tx.product.findFirst({ where: { episode_id: episodeId, sku: a.sku } });
    if (!product) throw new ToolError(`no product with sku ${a.sku}`);
    const total = a.qty * product.unit_cost_cents;
    const poId = await nextRowId(tx, 'purchase_orders', episodeId);
    await tx.purchaseOrder.create({ data: { episode_id: episodeId, id: poId, product_id: product.id, qty: a.qty, unit_cost_cents: product.unit_cost_cents, total_cents: total, created_step: step } });
    const month = isoDate(storeDate).slice(0, 7);
    const budget = await tx.budget.findFirst({ where: { episode_id: episodeId, month } });
    if (budget) await tx.budget.updateMany({ where: { episode_id: episodeId, id: budget.id }, data: { spent_cents: { increment: total } } });
    return {
      purchase_order_id: poId, sku: a.sku, qty: a.qty, total: dollars(total),
      budget_remaining: budget ? dollars(budget.restock_budget_cents - budget.spent_cents - total) : null,
    };
  },
});

export const scheduleEvent = defineTool({
  name: 'schedule_event',
  kind: 'act',
  description: 'Add an event to a staff member’s calendar. starts_at is IST, like 2026-03-10T14:30.',
  input: z
    .object({ staff_id: id, starts_at: z.string(), minutes: z.number().int().min(15).max(240), title: z.string().trim().min(1).max(200), customer_id: id.optional() })
    .strict(),
  async run({ tx, episodeId, step }, a) {
    const start = parseWallTime(a.starts_at);
    if (!start) throw new ToolError('starts_at must look like 2026-03-10T14:30 (IST)');
    const staff = await tx.staff.findFirst({ where: { episode_id: episodeId, id: a.staff_id } });
    if (!staff) throw new ToolError(`staff ${a.staff_id} not found`);
    if (a.customer_id !== undefined && !(await tx.customer.findFirst({ where: { episode_id: episodeId, id: a.customer_id } }))) {
      throw new ToolError(`customer ${a.customer_id} not found`);
    }
    const end = addMinutes(start, a.minutes);
    const eventId = await nextRowId(tx, 'calendar_events', episodeId);
    await tx.calendarEvent.create({ data: { episode_id: episodeId, id: eventId, staff_id: staff.id, title: a.title, starts_at: start, ends_at: end, customer_id: a.customer_id ?? null, created_step: step } });
    return { event_id: eventId, staff_id: staff.id, starts_at: formatWallTime(start), ends_at: formatWallTime(end) };
  },
});

export const requestManagerApproval = defineTool({
  name: 'request_manager_approval',
  kind: 'act',
  description: 'Ask a manager to approve a refund. Creates a pending approval; it does not refund anything.',
  input: z.object({ order_id: id, amount, reason }).strict(),
  async run({ tx, episodeId, step }, a) {
    const amountCents = cents(a.amount);
    const order = await tx.order.findFirst({ where: { episode_id: episodeId, id: a.order_id } });
    if (!order) throw new ToolError(`order ${a.order_id} not found`);
    const approvalId = await nextRowId(tx, 'approvals', episodeId);
    await tx.approval.create({ data: { episode_id: episodeId, id: approvalId, order_id: order.id, amount_cents: amountCents, reason: a.reason, status: 'pending', created_step: step } });
    return { approval_id: approvalId, order_id: order.id, amount: dollars(amountCents), status: 'pending' };
  },
});

export const submit = defineTool({
  name: 'submit',
  kind: 'end',
  description: 'Finish the task. The summary is stored but not used for scoring.',
  input: z.object({ summary: z.string().max(2000).default('') }).strict(),
  async run() {
    return { submitted: true };
  },
});

export const ACT_TOOLS = [replyToThread, issueRefund, createReplacement, updateShippingAddress, createPurchaseOrder, scheduleEvent, requestManagerApproval, submit];
