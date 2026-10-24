import type { Metadata } from 'next';
import Link from 'next/link';
import { RewardChip } from '@/components/reward-chip';
import { listRuns, taskTitle } from '@/lib/content';
import { modelLabel } from '@/lib/models';

export const metadata: Metadata = {
  title: 'Recorded runs',
  description: 'Every recorded BackOffice Gym run: 2 free models × 8 tasks × 3 seeds, each replayable step by step.',
};

export default function RunsIndex() {
  const runs = listRuns();
  return (
    <section className="py-8">
      <h1 className="font-serif text-4xl">Recorded runs</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">
        {runs.length} runs recorded through mcp-evals on 2026-10-22, every one replayed and its reward reproduced exactly.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-meta">
              <th className="py-2 pr-3 font-medium">Task</th>
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 font-medium">Seed</th>
              <th className="py-2 pr-3 font-medium">Steps</th>
              <th className="py-2 font-medium">Reward</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 pr-3">
                  <Link href={`/runs/${r.id}`}>{taskTitle(r.task)}</Link>
                </td>
                <td className="py-2 pr-3">{modelLabel(r.model)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.seed}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.steps}</td>
                <td className="py-2">
                  <RewardChip reward={r.reward} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
