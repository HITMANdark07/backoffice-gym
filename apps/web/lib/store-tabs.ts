import type { TableName } from '@backoffice-gym/db';
import type { Changed } from './replay-state';

export type StoreTab = 'inbox' | 'orders' | 'inventory' | 'calendar' | 'policy';

export const STORE_TABS: Array<{ id: StoreTab; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'policy', label: 'Policy' },
];

const TAB_OF: Record<TableName, StoreTab> = {
  threads: 'inbox', messages: 'inbox', customers: 'orders', orders: 'orders', order_items: 'orders', payments: 'orders',
  refunds: 'orders', replacements: 'orders', approvals: 'orders', products: 'inventory', purchase_orders: 'inventory',
  budget: 'inventory', staff: 'calendar', calendar_events: 'calendar', policy: 'policy',
};
const PRIORITY: StoreTab[] = ['orders', 'inventory', 'calendar', 'inbox', 'policy'];

/** The tab that shows what a step changed (the most important one if several), or null if nothing changed. */
export function tabFor(changed: Changed): StoreTab | null {
  const tabs = new Set((Object.keys(changed) as TableName[]).filter((t) => (changed[t]?.size ?? 0) > 0).map((t) => TAB_OF[t]));
  return PRIORITY.find((t) => tabs.has(t)) ?? null;
}

export const tabsWithChanges = (changed: Changed): Set<StoreTab> =>
  new Set((Object.keys(changed) as TableName[]).filter((t) => (changed[t]?.size ?? 0) > 0).map((t) => TAB_OF[t]));
