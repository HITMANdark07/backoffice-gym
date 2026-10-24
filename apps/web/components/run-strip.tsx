import type { Replay } from '@backoffice-gym/replay';
import Link from 'next/link';
import { firstFailingStep } from '@/lib/replay-state';
import { RewardChip } from './reward-chip';

export function RunStrip({ id, replay, label }: { id: string; replay: Replay; label: string }) {
  const failAt = firstFailingStep(replay);
  return (
    <Link href={`/runs/${id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 no-underline hover:bg-surface">
      <span className="w-14 shrink-0 font-mono text-xs text-fg-meta">{label}</span>
      <span aria-hidden="true" className="flex flex-1 gap-0.5">
        {replay.steps.map((s) => (
          <span key={s.n} className={`h-2 flex-1 rounded-sm ${s.n === failAt ? 'bg-bad' : s.changes.length > 0 ? 'bg-accent' : 'bg-border'}`} />
        ))}
      </span>
      <RewardChip reward={replay.score.reward} />
    </Link>
  );
}
