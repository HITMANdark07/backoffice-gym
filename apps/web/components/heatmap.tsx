import Link from 'next/link';
import type { HeatCell } from '@/lib/content';
import { taskTitle } from '@/lib/content';
import { modelLabel } from '@/lib/models';

const tone = (c: HeatCell) => (c.total === 0 ? 'bg-surface' : c.passed === c.total ? 'bg-ok-bg text-ok' : c.passed === 0 ? 'bg-bad-bg text-bad' : 'bg-hl');

export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const modelIds = [...new Set(cells.map((c) => c.model))];
  const tasks = [...new Set(cells.map((c) => c.task))];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-fg-meta">Model</th>
            {tasks.map((t) => (
              <th key={t} scope="col" className="text-left text-xs font-medium text-fg-meta">
                <Link href={`/tasks/${t}`}>{taskTitle(t)}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modelIds.map((m) => (
            <tr key={m}>
              <th scope="row" className="pr-2 text-left font-medium">
                {modelLabel(m)}
              </th>
              {tasks.map((t) => {
                const c = cells.find((x) => x.model === m && x.task === t)!;
                return (
                  <td key={t} data-cell={`${m}:${t}`} className={`rounded-md px-2 py-2 text-center font-mono text-xs ${tone(c)}`}>
                    {c.passed}/{c.total}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
