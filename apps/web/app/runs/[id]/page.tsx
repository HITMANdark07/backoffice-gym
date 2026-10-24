import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRightIcon } from '@/components/icons';
import { Player } from '@/components/player/player';
import { RewardChip } from '@/components/reward-chip';
import { getReplay, listRuns, taskTitle } from '@/lib/content';
import { notesFor } from '@/lib/featured';
import { checkLabel, rewardLabel } from '@/lib/format';
import { modelLabel } from '@/lib/models';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return listRuns().map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const replay = getReplay(id);
  if (!replay) return {};
  return {
    // ?step= links are the same page; search engines should index one URL.
    alternates: { canonical: `/runs/${id}` },
    title: `${modelLabel(replay.run.model)} on “${taskTitle(replay.run.task)}” (seed ${replay.run.seed})`,
    description: `A recorded BackOffice Gym run: reward ${rewardLabel(replay.score.reward)} in ${replay.steps.length} steps. Replay every tool call and see how the score was decided.`,
  };
}

export default async function RunPage({ params }: Props) {
  const { id } = await params;
  const replay = getReplay(id);
  if (!replay) notFound();
  const task = replay.run.task;
  return (
    <article className="py-8">
      <p className="text-sm text-fg-meta">
        <Link href="/runs">Runs</Link> / {taskTitle(task)}
      </p>
      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            {modelLabel(replay.run.model)} on “{taskTitle(task)}”
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Seed {replay.run.seed} · store date {replay.store_date} · {replay.prompt.split('\n')[2]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-fg-muted">{replay.steps.length} steps</span>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-fg-muted">env v{replay.env_version}</span>
          <RewardChip reward={replay.score.reward} />
        </div>
      </header>
      <div className="mt-6">
        <Player replay={replay} notes={notesFor(id)} />
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Final score</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-meta">
              <th className="py-2 pr-3 font-medium">Check</th>
              <th className="py-2 pr-3 font-medium">Kind</th>
              <th className="py-2 pr-3 font-medium">Passed</th>
              <th className="py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {replay.score.checks.map((c) => (
              <tr key={c.id} className="border-t border-border align-top">
                <td className="py-2 pr-3">{checkLabel(c.id)}</td>
                <td className="py-2 pr-3 text-fg-muted">{c.kind}</td>
                <td className={`py-2 pr-3 ${c.passed ? 'text-ok' : 'text-bad'}`}>{c.passed ? 'yes' : 'no'}</td>
                <td className="break-words py-2 text-fg-muted">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-sm">
          <Link href={`/tasks/${task}`} className="inline-flex items-center gap-1.5">
            More about “{taskTitle(task)}” and the other runs <ArrowRightIcon className="size-3.5" />
          </Link>
        </p>
      </section>
    </article>
  );
}
