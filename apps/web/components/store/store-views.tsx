import type { Dump, Row, TableName } from '@backoffice-gym/db';
import { day, money, time } from '@/lib/format';
import type { Changed } from '@/lib/replay-state';

interface ViewProps {
  state: Dump;
  changed: Changed;
}

const on = (changed: Changed, table: TableName, id: unknown): boolean => changed[table]?.has(Number(id)) ?? false;
const cx = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(' ');
const num = (row: Row | undefined, key: string): number => Number(row?.[key]);
const str = (row: Row | undefined, key: string): string => String(row?.[key] ?? '');

function names(state: Dump): Map<number, string> {
  return new Map(state.customers.map((c) => [num(c, 'id'), str(c, 'name')]));
}

export function InboxView({ state, changed }: ViewProps) {
  const who = names(state);
  const threads = [...state.threads].sort((a, b) => (str(a, 'status') === 'open' ? 0 : 1) - (str(b, 'status') === 'open' ? 0 : 1) || num(b, 'id') - num(a, 'id'));
  return (
    <div className="divide-y divide-border">
      {threads.map((t) => (
        <article key={str(t, 'id')} className={cx('p-3', on(changed, 'threads', t.id) && 'changed')}>
          <header className="flex flex-wrap justify-between gap-x-3 text-sm">
            <span className="font-medium">{str(t, 'subject')}</span>
            <span className="text-xs text-fg-meta">
              {who.get(num(t, 'customer_id'))} · {str(t, 'status')}
            </span>
          </header>
          <ul className="mt-2 space-y-1">
            {state.messages
              .filter((m) => num(m, 'thread_id') === num(t, 'id'))
              .map((m) => (
                <li key={str(m, 'id')} className={cx('rounded px-2 py-1 text-sm', on(changed, 'messages', m.id) && 'changed')}>
                  <span className="font-mono text-xs text-fg-meta">{str(m, 'author')}</span>{' '}
                  <span className="whitespace-pre-wrap break-words">{str(m, 'body')}</span>
                </li>
              ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function OrdersView({ state, changed }: ViewProps) {
  const who = names(state);
  const orders = [...state.orders].sort((a, b) => num(b, 'id') - num(a, 'id'));
  const extras = (orderId: number) => [
    ...state.payments.filter((p) => num(p, 'order_id') === orderId).map((p) => ({ table: 'payments' as const, row: p, text: `payment #${str(p, 'id')} · ${money(p.amount_cents)} · ${str(p, 'status')}` })),
    ...state.refunds.filter((r) => num(r, 'order_id') === orderId).map((r) => ({ table: 'refunds' as const, row: r, text: `refund #${str(r, 'id')} · ${money(r.amount_cents)} · on payment #${str(r, 'payment_id')}` })),
    ...state.replacements.filter((r) => num(r, 'order_id') === orderId).map((r) => ({ table: 'replacements' as const, row: r, text: `replacement #${str(r, 'id')} · qty ${str(r, 'qty')}` })),
    ...state.approvals.filter((a) => num(a, 'order_id') === orderId).map((a) => ({ table: 'approvals' as const, row: a, text: `approval #${str(a, 'id')} · ${money(a.amount_cents)} · ${str(a, 'status')}` })),
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-fg-meta">
          <th className="px-3 py-2 font-medium">Order</th>
          <th className="px-3 py-2 font-medium">Customer</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Total</th>
          <th className="hidden px-3 py-2 font-medium sm:table-cell">Delivered</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const id = num(o, 'id');
          const rows = extras(id).filter((x) => x.table !== 'payments' || state.payments.filter((p) => num(p, 'order_id') === id).length > 1 || on(changed, 'payments', x.row.id));
          return [
            <tr key={`o${id}`} className={cx('border-t border-border', on(changed, 'orders', id) && 'changed')}>
              <td className="px-3 py-2 font-mono text-xs">#{id}</td>
              <td className="px-3 py-2">{who.get(num(o, 'customer_id'))}</td>
              <td className="px-3 py-2">{str(o, 'status')}</td>
              <td className="px-3 py-2 font-mono text-xs">{money(o.total_cents)}</td>
              <td className="hidden px-3 py-2 text-xs sm:table-cell">{day(o.delivered_on)}</td>
            </tr>,
            ...rows.map((x) => (
              <tr key={`${x.table}${str(x.row, 'id')}`} className={cx(on(changed, x.table, x.row.id) && 'changed')}>
                <td />
                <td colSpan={4} className="px-3 pb-2 font-mono text-xs text-fg-muted">
                  ↳ {x.text}
                </td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}

export function InventoryView({ state, changed }: ViewProps) {
  const onOrder = (productId: number) => state.purchase_orders.filter((p) => num(p, 'product_id') === productId).reduce((s, p) => s + num(p, 'qty'), 0);
  const poChanged = (productId: number) => state.purchase_orders.some((p) => num(p, 'product_id') === productId && on(changed, 'purchase_orders', p.id));
  const budget = state.budget[0];
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-fg-meta">
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Product</th>
            <th className="px-3 py-2 font-medium">Stock</th>
            <th className="px-3 py-2 font-medium">Reorder at</th>
            <th className="px-3 py-2 font-medium">On order</th>
          </tr>
        </thead>
        <tbody>
          {state.products.map((p) => {
            const id = num(p, 'id');
            return (
              <tr key={id} className={cx('border-t border-border', (on(changed, 'products', id) || poChanged(id)) && 'changed')}>
                <td className="px-3 py-2 font-mono text-xs">{str(p, 'sku')}</td>
                <td className="hidden px-3 py-2 sm:table-cell">{str(p, 'name')}</td>
                <td className="px-3 py-2 font-mono text-xs">{str(p, 'stock')}</td>
                <td className="px-3 py-2 font-mono text-xs">{str(p, 'reorder_threshold')}</td>
                <td className="px-3 py-2 font-mono text-xs">{onOrder(id) || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {budget && (
        <p className={cx('flex justify-between border-t border-border px-3 py-3 text-sm', on(changed, 'budget', budget.id) && 'changed')}>
          <span>Restock budget ({str(budget, 'month')})</span>
          <span className="font-mono text-xs">
            spent {money(budget.spent_cents)} of {money(budget.restock_budget_cents)}
          </span>
        </p>
      )}
    </div>
  );
}

export function CalendarView({ state, changed }: ViewProps) {
  const staff = new Map(state.staff.map((s) => [num(s, 'id'), s]));
  const days = [...new Set(state.calendar_events.map((e) => day(e.starts_at)))].sort();
  return (
    <div className="divide-y divide-border">
      {days.map((d) => (
        <section key={d} className="p-3">
          <h4 className="text-xs font-medium text-fg-meta">{d}</h4>
          <ul className="mt-1 space-y-0.5">
            {state.calendar_events
              .filter((e) => day(e.starts_at) === d)
              .sort((a, b) => str(a, 'starts_at').localeCompare(str(b, 'starts_at')))
              .map((e) => {
                const s = staff.get(num(e, 'staff_id'));
                return (
                  <li key={str(e, 'id')} className={cx('flex gap-3 rounded px-2 py-0.5 text-sm', on(changed, 'calendar_events', e.id) && 'changed')}>
                    <span className="w-24 shrink-0 font-mono text-xs leading-6">
                      {time(e.starts_at)}–{time(e.ends_at)}
                    </span>
                    <span className="min-w-0">
                      {str(e, 'title')} <span className="text-fg-meta">· {str(s, 'name')} ({str(s, 'role')})</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PolicyView({ state }: ViewProps) {
  const text = str(state.policy[0], 'text');
  return (
    <div className="space-y-2 p-3 text-sm">
      {text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line, i) =>
          line.startsWith('#') ? (
            <h4 key={i} className="font-serif text-lg">
              {line.replace(/^#+\s*/, '')}
            </h4>
          ) : (
            <p key={i}>{line.replace(/\*\*/g, '')}</p>
          ),
        )}
    </div>
  );
}
