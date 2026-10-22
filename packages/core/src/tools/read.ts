import { z } from 'zod';
import { ToolError } from '../errors';
import { ORDER_STATUSES } from '../store/types';
import { dollars } from '../util/money';
import { daysBetween, formatWallTime, isoDate, parseWallTime } from '../util/time';
import { defineTool } from './types';

const id = z.number().int().positive();
const day = (d: Date | null): string | null => (d ? isoDate(d) : null);
const preview = (text: string | undefined): string => (!text ? '' : text.length > 120 ? `${text.slice(0, 120)}…` : text);

export const readPolicy = defineTool({
  name: 'read_policy',
  kind: 'read',
  description: 'Read the store policy. Follow it for every decision.',
  input: z.object({}).strict(),
  async run({ tx, episodeId }) {
    const policy = await tx.policy.findFirst({ where: { episode_id: episodeId }, orderBy: { id: 'asc' } });
    return { policy: policy?.text ?? '' };
  },
});

export const listInbox = defineTool({
  name: 'list_inbox',
  kind: 'read',
  description: 'List support threads. Defaults to open threads.',
  input: z.object({ status: z.enum(['open', 'replied', 'all']).default('open') }).strict(),
  async run({ tx, episodeId }, { status }) {
    const threads = await tx.thread.findMany({
      where: { episode_id: episodeId, ...(status === 'all' ? {} : { status }) },
      orderBy: { id: 'asc' },
      include: { customer: true, messages: { orderBy: { id: 'asc' } } },
    });
    return {
      threads: threads.map((t) => ({
        thread_id: t.id, subject: t.subject, status: t.status, customer_id: t.customer_id, customer_name: t.customer.name,
        messages: t.messages.length, last_message: preview(t.messages.at(-1)?.body),
      })),
    };
  },
});

export const readThread = defineTool({
  name: 'read_thread',
  kind: 'read',
  description: 'Read every message in a support thread.',
  input: z.object({ thread_id: id }).strict(),
  async run({ tx, episodeId }, { thread_id }) {
    const t = await tx.thread.findFirst({
      where: { episode_id: episodeId, id: thread_id },
      include: { customer: true, messages: { orderBy: { id: 'asc' } } },
    });
    if (!t) throw new ToolError(`thread ${thread_id} not found`);
    return {
      thread_id: t.id, subject: t.subject, status: t.status,
      customer: { customer_id: t.customer.id, name: t.customer.name, email: t.customer.email },
      messages: t.messages.map((m) => ({ message_id: m.id, author: m.author, body: m.body })),
    };
  },
});

export const searchOrders = defineTool({
  name: 'search_orders',
  kind: 'read',
  description: 'Find orders by order id, customer id, customer email or status. Returns at most 20.',
  input: z
    .object({ order_id: id.optional(), customer_id: id.optional(), customer_email: z.string().trim().min(3).optional(), status: z.enum(ORDER_STATUSES).optional() })
    .strict(),
  async run({ tx, episodeId }, a) {
    const orders = await tx.order.findMany({
      where: {
        episode_id: episodeId,
        ...(a.order_id !== undefined ? { id: a.order_id } : {}),
        ...(a.customer_id !== undefined ? { customer_id: a.customer_id } : {}),
        ...(a.status ? { status: a.status } : {}),
        ...(a.customer_email ? { customer: { is: { email: { equals: a.customer_email, mode: 'insensitive' as const } } } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 21,
    });
    return {
      orders: orders.slice(0, 20).map((o) => ({ order_id: o.id, customer_id: o.customer_id, status: o.status, placed_on: day(o.placed_on), total: dollars(o.total_cents) })),
      truncated: orders.length > 20,
    };
  },
});

export const getOrder = defineTool({
  name: 'get_order',
  kind: 'read',
  description: 'Full order details: items, payments, refunds, replacements, approvals and shipping dates.',
  input: z.object({ order_id: id }).strict(),
  async run({ tx, episodeId, storeDate }, { order_id }) {
    const o = await tx.order.findFirst({
      where: { episode_id: episodeId, id: order_id },
      include: {
        items: { orderBy: { id: 'asc' }, include: { product: true } },
        payments: { orderBy: { id: 'asc' } },
        refunds: { orderBy: { id: 'asc' } },
        replacements: { orderBy: { id: 'asc' }, include: { product: true } },
        approvals: { orderBy: { id: 'asc' } },
      },
    });
    if (!o) throw new ToolError(`order ${order_id} not found`);
    return {
      order_id: o.id, customer_id: o.customer_id, status: o.status, placed_on: day(o.placed_on), shipped_on: day(o.shipped_on),
      delivered_on: day(o.delivered_on), days_since_delivery: o.delivered_on ? daysBetween(o.delivered_on, storeDate) : null,
      shipping_address: o.shipping_address, total: dollars(o.total_cents),
      items: o.items.map((i) => ({ sku: i.product.sku, name: i.product.name, qty: i.qty, unit_price: dollars(i.unit_price_cents) })),
      payments: o.payments.map((p) => ({ payment_id: p.id, amount: dollars(p.amount_cents), captured_on: day(p.captured_on), status: p.status })),
      refunds: o.refunds.map((r) => ({ refund_id: r.id, payment_id: r.payment_id, amount: dollars(r.amount_cents), reason: r.reason })),
      replacements: o.replacements.map((r) => ({ replacement_id: r.id, sku: r.product.sku, qty: r.qty })),
      approvals: o.approvals.map((a) => ({ approval_id: a.id, amount: dollars(a.amount_cents), status: a.status })),
    };
  },
});

export const getCustomer = defineTool({
  name: 'get_customer',
  kind: 'read',
  description: 'Look up a customer by id or email.',
  input: z
    .object({ customer_id: id.optional(), email: z.string().trim().min(3).optional() })
    .strict()
    .refine((a) => a.customer_id !== undefined || a.email !== undefined, { message: 'give customer_id or email' }),
  async run({ tx, episodeId }, a) {
    const c = await tx.customer.findFirst({
      where: {
        episode_id: episodeId,
        ...(a.customer_id !== undefined ? { id: a.customer_id } : {}),
        ...(a.email ? { email: { equals: a.email, mode: 'insensitive' as const } } : {}),
      },
      include: { orders: { orderBy: { id: 'asc' }, select: { id: true } } },
    });
    if (!c) throw new ToolError('customer not found');
    return { customer_id: c.id, name: c.name, email: c.email, tier: c.tier, customer_since: day(c.created_on), order_ids: c.orders.map((o) => o.id) };
  },
});

export const checkInventory = defineTool({
  name: 'check_inventory',
  kind: 'read',
  description: "Stock levels, reorder settings and this month's restock budget. Filter by sku or to products below their reorder threshold.",
  input: z.object({ sku: z.string().trim().min(1).optional(), below_threshold: z.boolean().optional() }).strict(),
  async run({ tx, episodeId, storeDate }, a) {
    const products = await tx.product.findMany({ where: { episode_id: episodeId, ...(a.sku ? { sku: a.sku } : {}) }, orderBy: { id: 'asc' } });
    if (a.sku && products.length === 0) throw new ToolError(`no product with sku ${a.sku}`);
    const month = isoDate(storeDate).slice(0, 7);
    const budget = await tx.budget.findFirst({ where: { episode_id: episodeId, month } });
    return {
      products: products
        .filter((p) => !a.below_threshold || p.stock < p.reorder_threshold)
        .map((p) => ({
          sku: p.sku, name: p.name, stock: p.stock, reorder_threshold: p.reorder_threshold, reorder_qty: p.reorder_qty,
          unit_price: dollars(p.unit_price_cents), unit_cost: dollars(p.unit_cost_cents), supplier: p.supplier,
        })),
      restock_budget: budget
        ? { month, budget: dollars(budget.restock_budget_cents), spent: dollars(budget.spent_cents), remaining: dollars(budget.restock_budget_cents - budget.spent_cents) }
        : null,
    };
  },
});

const TIME_HINT = 'from and to must look like 2026-03-10T09:00 (IST)';

export const listCalendar = defineTool({
  name: 'list_calendar',
  kind: 'read',
  description: 'List staff and their calendar events between two IST times (YYYY-MM-DDTHH:mm), at most 14 days apart.',
  input: z.object({ staff_id: id.optional(), from: z.string(), to: z.string() }).strict(),
  async run({ tx, episodeId }, a) {
    const from = parseWallTime(a.from);
    const to = parseWallTime(a.to);
    if (!from || !to) throw new ToolError(TIME_HINT);
    if (to <= from) throw new ToolError('to must be after from');
    if (to.getTime() - from.getTime() > 14 * 86_400_000) throw new ToolError('the range can be at most 14 days');
    const [staff, events] = await Promise.all([
      tx.staff.findMany({ where: { episode_id: episodeId }, orderBy: { id: 'asc' } }),
      tx.calendarEvent.findMany({
        where: { episode_id: episodeId, starts_at: { lt: to }, ends_at: { gt: from }, ...(a.staff_id !== undefined ? { staff_id: a.staff_id } : {}) },
        orderBy: [{ starts_at: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return {
      staff: staff.map((s) => ({ staff_id: s.id, name: s.name, role: s.role, on_duty: s.on_duty })),
      events: events.map((e) => ({ event_id: e.id, staff_id: e.staff_id, title: e.title, starts_at: formatWallTime(e.starts_at), ends_at: formatWallTime(e.ends_at), customer_id: e.customer_id })),
    };
  },
});

export const READ_TOOLS = [readPolicy, listInbox, readThread, searchOrders, getOrder, getCustomer, checkInventory, listCalendar];
