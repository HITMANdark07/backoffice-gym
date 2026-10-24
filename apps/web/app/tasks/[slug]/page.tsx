import { GENERIC_CHECKS, TASKS } from '@backoffice-gym/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunStrip } from '@/components/run-strip';
import { getReplay, models, runsForTask } from '@/lib/content';
import { modelLabel } from '@/lib/models';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return TASKS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const task = TASKS.find((t) => t.slug === slug);
  return task ? { title: `Task: ${task.title}`, description: task.summary } : {};
}

export default async function TaskPage({ params }: Props) {
  const { slug } = await params;
  const task = TASKS.find((t) => t.slug === slug);
  if (!task) notFound();
  const required = task.checks.filter((c) => c.kind === 'required');
  const forbidden = [...task.checks.filter((c) => c.kind === 'forbidden'), ...GENERIC_CHECKS];
  const runs = runsForTask(slug);
  return (
    <article className="py-8">
      <p className="text-sm text-fg-meta">
        <Link href="/tasks">Tasks</Link> / {task.title}
      </p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{task.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-fg-muted">{task.summary}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/try/${slug}`} className="rounded-full bg-accent px-4 py-2 text-sm text-accent-fg no-underline">
          Try this task yourself
        </Link>
      </div>

      <section className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl">To score, the agent must</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {required.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-3">
                {c.description} <span className="font-mono text-xs text-fg-meta">weight {c.weight ?? 1}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-2xl">Any of these sets the reward to 0</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {forbidden.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-3">
                {c.description}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Recorded runs</h2>
        <p className="mt-1 text-sm text-fg-muted">Each bar is one run: a segment per tool call, blue where it changed the store, red where a forbidden check failed.</p>
        <div className="mt-4 space-y-6">
          {models().map((model) => (
            <div key={model}>
              <h3 className="text-sm font-semibold">{modelLabel(model)}</h3>
              <div className="mt-1">
                {runs
                  .filter((r) => r.model === model)
                  .map((r) => {
                    const replay = getReplay(r.id);
                    return replay ? <RunStrip key={r.id} id={r.id} replay={replay} label={`seed ${r.seed}`} /> : null;
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
