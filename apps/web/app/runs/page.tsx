import type { Metadata } from 'next';
import Link from 'next/link';
import { RewardChip } from '@/components/reward-chip';
import { listRuns, stats, taskTitle } from '@/lib/content';
import { modelLabel } from '@/lib/models';

export const metadata: Metadata = {
  title: 'Recorded runs',
  description: (() => {
    const s = stats();
    return `Every recorded BackOffice Gym run: ${s.models} models × ${s.tasks} tasks × ${s.seedsPerCell} seeds, each replayable step by step.`;
  })(),
};

export default function RunsIndex() {
  const runs = listRuns();
  return (
    <section className="py-8">
      <h1 className="font-display text-4xl">Recorded runs</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">
        {(() => {
          const s = stats();
          return `${s.runs} runs recorded through mcp-evals on ${s.recordedOn}; ${s.reproduced} of ${s.runs} replays reproduced their recorded reward exactly.`;
        })()}
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
