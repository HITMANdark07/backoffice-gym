import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getReplay, listRuns } from '@/lib/content';
import { changedAt, stateAt } from '@/lib/replay-state';
import { StorePanel } from './store-panel';
import { CalendarView, InboxView, InventoryView, OrdersView, PolicyView } from './store-views';

const run = listRuns().find((r) => r.task === 'damaged-item' && r.reward === 0)!;
const replay = getReplay(run.id)!;
const poStep = replay.steps.find((s) => s.tool === 'create_purchase_order')!.n;

describe('store views', () => {
  it('highlights the product and budget a purchase order changed', () => {
    const html = renderToString(<InventoryView state={stateAt(replay, poStep)} changed={changedAt(replay, poStep)} />);
    expect(html).toMatch(/class="[^"]*changed[^"]*"[^>]*>.*KETTLE-STL/s);
    expect(html).toContain('Restock budget');
  });

  it('renders orders with their refunds, the inbox, the calendar and the policy', () => {
    const end = stateAt(replay, replay.steps.length);
    const none = {};
    expect(renderToString(<OrdersView state={end} changed={none} />)).toMatch(/refund #1.*\$54\.00/s);
    expect(renderToString(<InboxView state={end} changed={none} />)).toContain('arrived damaged');
    expect(renderToString(<CalendarView state={end} changed={none} />)).toMatch(/\d{2}:\d{2}/);
    expect(renderToString(<PolicyView state={end} changed={none} />)).toContain('Refund window');
  });

  it('opens on the tab with the current step’s changes', () => {
    const html = renderToString(<StorePanel state={stateAt(replay, poStep)} changed={changedAt(replay, poStep)} />);
    expect(html).toMatch(/aria-selected="true"[^>]*>Inventory/);
    expect(html).toContain('role="tablist"');
  });
});

describe('inbox highlight', () => {
  it('highlights the new reply, not the whole thread around it', () => {
    const replyStep = replay.steps.find((s) => s.tool === 'reply_to_thread')!.n;
    const html = renderToString(<InboxView state={stateAt(replay, replyStep)} changed={changedAt(replay, replyStep)} />);
    expect(html.match(/class="[^"]*\bchanged\b[^"]*"/g)).toHaveLength(1);
    expect(html).toMatch(/<li class="[^"]*\bchanged\b[^"]*"><span class="font-mono text-xs text-fg-meta">agent/);
  });
});
