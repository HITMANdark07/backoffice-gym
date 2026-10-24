import type { CheckResult, ScoreResult } from '@backoffice-gym/core';
import type { Replay } from '@backoffice-gym/replay';
import { checkLabel, rewardLabel } from '@/lib/format';

type Status = 'ok' | 'bad' | 'wait';

function status(c: CheckResult, step: number, done: boolean): Status {
  if (step === 0) return 'wait';
  if (c.kind === 'forbidden') return c.passed ? 'ok' : 'bad';
  return c.passed ? 'ok' : done ? 'bad' : 'wait';
}

const ICON: Record<Status, { glyph: string; label: string; cls: string }> = {
  ok: { glyph: '✓', label: 'passed', cls: 'bg-ok-bg text-ok' },
  bad: { glyph: '✕', label: 'failed', cls: 'bg-bad-bg text-bad' },
  wait: { glyph: '', label: 'pending', cls: 'border border-dashed border-border' },
};

export function Scorecard({ replay, step, score }: { replay: Replay; step: number; score: ScoreResult | null }) {
  const done = step >= replay.steps.length;
  const checks = (score ?? replay.score).checks;
  const headline =
    step === 0 ? 'Scorecard · not started' : done ? `Reward ${rewardLabel(replay.score.reward)}` : `If it stopped here: ${rewardLabel(score?.reward ?? 0)}`;
  const failing = step > 0 && checks.some((c) => c.kind === 'forbidden' && !c.passed);
  return (
    <div className="border-t border-border p-4">
      <h3 className="flex justify-between gap-2 text-sm font-semibold">
        <span>Scorecard</span>
        <span className={`font-mono ${failing ? 'text-bad' : done && replay.score.reward === 1 ? 'text-ok' : 'text-fg-muted'}`}>{headline}</span>
      </h3>
      <ul className="mt-2">
        {checks.map((c) => {
          const st = status(c, step, done);
          const icon = ICON[st];
          return (
            <li key={c.id} className={`flex gap-2.5 border-t border-dashed border-border py-1.5 text-sm first:border-t-0 ${st === 'bad' && c.kind === 'forbidden' ? 'rounded bg-bad-bg px-2' : ''}`}>
              <span role="img" aria-label={icon.label} className={`grid size-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${icon.cls}`}>
                {icon.glyph}
              </span>
              <span className="min-w-0">
                {checkLabel(c.id)}
                {c.kind === 'forbidden' && <span className="ml-1 text-xs text-fg-meta">(must not fail)</span>}
                <small className="block break-words text-xs text-fg-meta">{step === 0 ? (c.kind === 'forbidden' ? 'must stay true' : 'not yet') : c.detail}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
