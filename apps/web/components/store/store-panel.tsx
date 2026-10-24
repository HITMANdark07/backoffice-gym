'use client';

import type { Dump } from '@backoffice-gym/db';
import { useEffect, useState } from 'react';
import type { Changed } from '@/lib/replay-state';
import { STORE_TABS, tabFor, tabsWithChanges, type StoreTab } from '@/lib/store-tabs';
import { CalendarView, InboxView, InventoryView, OrdersView, PolicyView } from './store-views';

const VIEWS = { inbox: InboxView, orders: OrdersView, inventory: InventoryView, calendar: CalendarView, policy: PolicyView };

export function StorePanel({ state, changed }: { state: Dump; changed: Changed }) {
  const auto = tabFor(changed);
  const [tab, setTab] = useState<StoreTab>(auto ?? 'inbox');
  useEffect(() => {
    if (auto) setTab(auto);
  }, [auto, changed]);
  const dots = tabsWithChanges(changed);
  const View = VIEWS[tab];
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
      <div role="tablist" aria-label="Store apps" className="flex gap-0.5 overflow-x-auto border-b border-border p-2">
        {STORE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${tab === t.id ? 'bg-fg text-bg' : 'text-fg-muted hover:text-fg'}`}
          >
            {t.label}
            {dots.has(t.id) && <span aria-label="changed in this step" className="ml-1.5 inline-block size-1.5 rounded-full bg-hl-edge align-middle" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="max-h-[30rem] overflow-auto">
        <View state={state} changed={changed} />
      </div>
    </div>
  );
}
