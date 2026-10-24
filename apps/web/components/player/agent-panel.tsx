import type { Replay } from '@backoffice-gym/replay';
import { formatArgs, truncate } from '@/lib/format';

export function AgentPanel({ replay, step, note }: { replay: Replay; step: number; note?: string | undefined }) {
  if (step === 0) {
    return (
      <div className="p-4">
        <p className="font-mono text-xs text-fg-meta">START · the task the agent was given</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{replay.prompt}</p>
      </div>
    );
  }
  const s = replay.steps[step - 1]!;
  return (
    <div className="p-4">
      <p className="font-mono text-xs text-fg-meta">
        STEP {s.n} OF {replay.steps.length} · {s.tool}
      </p>
      {note && <p className="mt-2 text-sm text-fg-muted">{note}</p>}
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg p-3 font-mono text-[13px] leading-relaxed">
        <span className="text-accent">{s.tool}</span>({formatArgs(s.args)})
      </pre>
      <pre className={`mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs ${s.ok ? 'text-fg-muted' : 'text-bad'}`}>
        {s.ok ? `→ ${truncate(JSON.stringify(s.result ?? null), 400)}` : `✕ ${s.error ?? 'error'}`}
      </pre>
    </div>
  );
}
