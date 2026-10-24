import { TASKS } from '@backoffice-gym/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TryConsole } from '@/components/try/try-console';
import { runsForTask } from '@/lib/content';
import { modelLabel } from '@/lib/models';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return TASKS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const task = TASKS.find((t) => t.slug === slug);
  return task ? { title: `Try it: ${task.title}`, description: `Play “${task.title}” with the agents’ tools and scorer, then compare your reward. ${task.summary}` } : {};
}

export default async function TryPage({ params }: Props) {
  const { slug } = await params;
  const task = TASKS.find((t) => t.slug === slug);
  if (!task) notFound();
  const recorded = runsForTask(slug).map((r) => ({ id: r.id, label: `${modelLabel(r.model)} · seed ${r.seed}`, reward: r.reward }));
  return (
    <section className="py-8">
      <p className="text-sm text-fg-meta">
        <Link href={`/tasks/${slug}`}>{task.title}</Link> / Try it yourself
      </p>
      <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Try it: {task.title}</h1>
      <p className="mt-3 max-w-2xl text-fg-muted">{task.summary}</p>
      <div className="mt-6">
        <TryConsole task={slug} recorded={recorded} />
      </div>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">Recorded runs to beat</h2>
        <ul className="mt-2 space-y-0.5 text-sm">
          {recorded.map((r) => (
            <li key={r.id}>
              <Link href={`/runs/${r.id}`}>{r.label}</Link>: reward {r.reward}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
