'use client';

import type { ScoreResult } from '@backoffice-gym/core';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { checkLabel, rewardLabel, truncate } from '@/lib/format';
import { argsFrom, describeApiError, fieldsFor } from '@/lib/schema-form';

interface ToolInfo {
  name: string;
  description: string;
  kind: string;
  input_schema: Record<string, unknown>;
}
interface Recorded {
  id: string;
  label: string;
  reward: number;
}
interface LogEntry {
  step: number;
  tool: string;
  ok: boolean;
  text: string;
}

async function call(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { status: 0, body: null };
  }
}

export function TryConsole({ task, recorded }: { task: string; recorded: Recorded[] }) {
  const [episode, setEpisode] = useState<{ id: string; prompt: string; tools: ToolInfo[] } | null>(null);
  const [tool, setTool] = useState('read_policy');
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [log, setLog] = useState<LogEntry[]>([]);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = episode?.tools.find((t) => t.name === tool);
  const fields = useMemo(() => (current ? fieldsFor(current.input_schema) : []), [current]);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await call('/api/episodes', { task });
    setBusy(false);
    if (r.status !== 201) return setError(describeApiError(r.status, r.body));
    const b = r.body as { episode_id: string; task: { prompt: string }; tools: ToolInfo[] };
    setEpisode({ id: b.episode_id, prompt: b.task.prompt, tools: b.tools });
    setLog([]);
    setScore(null);
    setTool('read_policy');
    setValues({});
  }

  async function run() {
    if (!episode) return;
    setBusy(true);
    setError(null);
    const r = await call(`/api/episodes/${episode.id}/step`, { tool, args: argsFrom(fields, values) });
    setBusy(false);
    if (r.status !== 200) return setError(describeApiError(r.status, r.body));
    const s = r.body as { step: number; ok: boolean; result?: unknown; error?: string; done: boolean; score?: ScoreResult };
    setLog((l) => [...l, { step: s.step, tool, ok: s.ok, text: s.ok ? truncate(JSON.stringify(s.result, null, 2), 1500) : (s.error ?? 'error') }]);
    if (s.done && s.score) setScore(s.score);
  }

  if (!episode) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-fg-muted">You get the same tools and the same scorer as the agents. A fresh store is generated for you.</p>
        <button type="button" onClick={start} disabled={busy} className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm text-accent-fg disabled:opacity-60">
          {busy ? 'Starting…' : 'Start an episode'}
        </button>
        {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-mono text-xs text-fg-meta">YOUR TASK</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{episode.prompt}</p>
        </div>
        {!score && (
          <form
            className="space-y-3 rounded-xl border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <label className="block text-sm">
              Tool
              <select value={tool} onChange={(e) => { setTool(e.target.value); setValues({}); }} className="mt-1 block w-full rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-sm">
                {episode.tools.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {current && <p className="text-xs text-fg-meta">{current.description}</p>}
            {fields.map((f) => (
              <label key={f.name} className="block text-sm">
                <span className="font-mono">{f.name}</span>
                {!f.required && <span className="text-fg-meta"> (optional)</span>}
                {f.type === 'boolean' ? (
                  <input type="checkbox" checked={values[f.name] === true} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} className="ml-2" />
                ) : f.type === 'enum' ? (
                  <select value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="mt-1 block w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {f.options?.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'text' ? (
                  <textarea value={String(values[f.name] ?? '')} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} rows={4} className="mt-1 block w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" />
                ) : (
                  <input
                    inputMode={f.type === 'string' ? 'text' : 'decimal'}
                    value={String(values[f.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-sm"
                  />
                )}
              </label>
            ))}
            <button type="submit" disabled={busy} className="rounded-full bg-accent px-5 py-2 text-sm text-accent-fg disabled:opacity-60">
              {busy ? 'Running…' : `Run ${tool}`}
            </button>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          </form>
        )}
        {score && (
          <div className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-serif text-2xl">Your reward: {rewardLabel(score.reward)}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {score.checks.map((c) => (
                <li key={c.id} className={c.passed ? 'text-ok' : 'text-bad'}>
                  {c.passed ? '✓' : '✕'} {checkLabel(c.id)} <span className="text-fg-meta">· {c.detail}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-semibold">The recorded agents on this task</h3>
            <ul className="mt-1 space-y-0.5 text-sm">
              {recorded.map((r) => (
                <li key={r.id}>
                  <Link href={`/runs/${r.id}`}>{r.label}</Link>: reward {rewardLabel(r.reward)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={start} className="mt-4 rounded-full border border-border px-4 py-2 text-sm">
              Try another seed
            </button>
          </div>
        )}
      </div>
      <ol className="min-w-0 space-y-2" aria-label="Your steps">
        {log.map((e) => (
          <li key={e.step} className="rounded-xl border border-border bg-surface p-3">
            <p className="font-mono text-xs text-fg-meta">
              STEP {e.step} · {e.tool}
            </p>
            <pre className={`mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs ${e.ok ? 'text-fg-muted' : 'text-bad'}`}>{e.text}</pre>
          </li>
        ))}
      </ol>
    </div>
  );
}
