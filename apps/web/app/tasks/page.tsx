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
      <ul className="mt-8 border-b border-border">
        {TASKS.map((t) => {
          const runs = runsForTask(t.slug);
          return (
            <li key={t.slug}>
              <Link href={`/tasks/${t.slug}`} className="group grid gap-1 border-t border-border py-5 no-underline sm:grid-cols-[16rem_1fr_auto] sm:items-baseline sm:gap-8">
                <h2 className="font-serif text-2xl leading-snug group-hover:text-accent">{t.title}</h2>
                <p className="max-w-prose text-sm text-fg-muted">{t.summary}</p>
                <p className="font-mono text-xs text-fg-meta sm:text-right">{`${runs.filter((r) => r.reward === 1).length}/${runs.length} runs at reward 1`}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
