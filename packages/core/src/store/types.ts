import type { PolicyRules } from './policy';

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'refunded', 'partially_refunded', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface CustomerRow { id: number; name: string; email: string; tier: 'standard' | 'vip'; created_on: Date }
export interface ProductRow {
  id: number; sku: string; name: string; unit_price_cents: number; unit_cost_cents: number;
  stock: number; reorder_threshold: number; reorder_qty: number; supplier: string;
}
export interface StaffRow { id: number; name: string; role: 'support' | 'manager' | 'buyer'; on_duty: boolean }
export interface OrderRow {
  id: number; customer_id: number; status: OrderStatus; placed_on: Date; shipped_on: Date | null;
  delivered_on: Date | null; shipping_address: string; total_cents: number;
}
export interface OrderItemRow { id: number; order_id: number; product_id: number; qty: number; unit_price_cents: number }
export interface PaymentRow { id: number; order_id: number; amount_cents: number; captured_on: Date; status: 'captured' | 'refunded' }
export interface RefundRow { id: number; order_id: number; payment_id: number; amount_cents: number; reason: string; created_step: number }
export interface ReplacementRow { id: number; order_id: number; product_id: number; qty: number; created_step: number }
export interface PurchaseOrderRow { id: number; product_id: number; qty: number; unit_cost_cents: number; total_cents: number; created_step: number }
export interface ApprovalRow { id: number; order_id: number; amount_cents: number; reason: string; status: 'pending'; created_step: number }
export interface ThreadRow { id: number; customer_id: number; subject: string; status: 'open' | 'replied' }
export interface MessageRow { id: number; thread_id: number; author: 'customer' | 'agent' | 'staff'; body: string; sent_step: number }
export interface CalendarEventRow {
  id: number; staff_id: number; title: string; starts_at: Date; ends_at: Date; customer_id: number | null; created_step: number;
}
export interface BudgetRow { id: number; month: string; restock_budget_cents: number; spent_cents: number }
export interface PolicyRow { id: number; text: string; rules: PolicyRules }

/** One store's rows, keyed exactly like the database tables. */
export interface StoreRows {
  customers: CustomerRow[];
  products: ProductRow[];
  staff: StaffRow[];
  orders: OrderRow[];
  order_items: OrderItemRow[];
  payments: PaymentRow[];
  refunds: RefundRow[];
  replacements: ReplacementRow[];
  purchase_orders: PurchaseOrderRow[];
  approvals: ApprovalRow[];
  threads: ThreadRow[];
  messages: MessageRow[];
  calendar_events: CalendarEventRow[];
  budget: BudgetRow[];
  policy: PolicyRow[];
}
