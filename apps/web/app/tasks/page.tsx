import { TASKS } from '@backoffice-gym/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { runsForTask } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Tasks',
  description: 'The 8 BackOffice Gym tasks, 3 of them traps: what the agent faces, what it must do, and what scores 0.',
};

export default function TasksIndex() {
  return (
    <section className="py-8">
      <h1 className="font-serif text-4xl">Tasks</h1>
      <p className="mt-2 max-w-2xl text-fg-muted">Every task is generated from a seed: new customers, amounts and dates each time, the same rules.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {TASKS.map((t) => {
          const runs = runsForTask(t.slug);
          return (
            <li key={t.slug}>
              <Link href={`/tasks/${t.slug}`} className="block h-full rounded-xl border border-border bg-surface p-4 no-underline hover:border-accent">
                <h2 className="font-serif text-2xl">{t.title}</h2>
                <p className="mt-1 text-sm text-fg-muted">{t.summary}</p>
                <p className="mt-3 font-mono text-xs text-fg-meta">{`${runs.filter((r) => r.reward === 1).length}/${runs.length} runs at reward 1`}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
