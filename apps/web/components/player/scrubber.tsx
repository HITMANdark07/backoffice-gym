import type { Replay } from '@backoffice-gym/replay';
import { PauseIcon, PlayIcon } from '@/components/icons';

interface Props {
  replay: Replay;
  step: number;
  playing: boolean;
  failAt: number | null;
  compact?: boolean;
  onSeek(step: number): void;
  onToggle(): void;
}

export function Scrubber({ replay, step, playing, failAt, compact = false, onSeek, onToggle }: Props) {
  const seg = (n: number, writes: boolean) => {
    const color = n === step ? (n === failAt ? 'bg-bad' : 'bg-accent') : n === failAt ? 'bg-bad/60' : n < step ? 'bg-accent/35' : 'bg-fg-meta/40';
    return `block h-2 w-full rounded transition-[filter,transform] duration-150 hover:scale-y-150 hover:brightness-90 ${color} ${writes ? 'ring-1 ring-accent ring-inset' : ''}`;
  };
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} className="grid size-10 shrink-0 place-items-center rounded-full bg-fg text-bg transition-transform duration-150 hover:scale-105 active:scale-95">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <ol aria-label="Steps" className="flex flex-1 gap-1">
          <li className="flex-1">
            <button type="button" aria-label="Start" aria-current={step === 0 ? 'step' : undefined} onClick={() => onSeek(0)} className={seg(0, false)} />
          </li>
          {replay.steps.map((s) => (
            <li key={s.n} className="flex-1">
              <button
                type="button"
                aria-label={`Step ${s.n}: ${s.tool}`}
                aria-current={s.n === step ? 'step' : undefined}
                onClick={() => onSeek(s.n)}
                className={seg(s.n, s.changes.length > 0)}
              />
            </li>
          ))}
        </ol>
        <span className="font-mono text-xs text-fg-meta">
          {step}/{replay.steps.length}
        </span>
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-fg-meta">
          <kbd>Space</kbd> plays and pauses · <kbd>←</kbd> <kbd>→</kbd> step · outlined steps changed the store · red: a forbidden check fails
        </p>
      )}
    </div>
  );
}
