import Link from 'next/link';
import { FeaturedReel } from '@/components/featured-reel';
import { Heatmap } from '@/components/heatmap';
import { heatmap, stats, taskTitle } from '@/lib/content';
import { resolveFeatured } from '@/lib/featured';
import { modelLabel } from '@/lib/models';
import { site } from '@/lib/site';

export default function Home() {
  const s = stats();
  const items = resolveFeatured().map((f) => ({
    id: f.id,
    replay: f.replay,
    notes: f.notes,
    headline: f.spec.headline,
    caption: `${modelLabel(f.spec.model)} · ${taskTitle(f.spec.task)} · seed ${f.spec.seed}`,
  }));
  return (
    <>
      <section className="pt-10 sm:pt-14">
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.02] sm:text-6xl">{site.tagline}</h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-muted">Scored by SQL against the database, not by another model. Eight tasks, three of them traps, and every run replayable step by step.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/try/injection-trap" className="rounded-full bg-accent px-5 py-2.5 text-sm text-accent-fg no-underline">
            Try it yourself
          </Link>
          <a href="#results" className="rounded-full border border-border px-5 py-2.5 text-sm no-underline">
            See the results
          </a>
        </div>
      </section>

      <section className="mt-10" aria-label="Featured runs">
        <FeaturedReel items={items} />
      </section>

      <section className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-5" aria-label="Key numbers">
        {[
          [s.tasks, 'tasks'],
          [s.traps, 'traps'],
          [s.runs, 'recorded runs'],
          [s.perfect, 'runs at reward 1'],
          [s.runs, 'replays reproduced exactly'],
        ].map(([n, label]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-serif text-4xl">{n}</p>
            <p className="text-sm text-fg-muted">{label}</p>
          </div>
        ))}
      </section>

      <section id="results" className="mt-14 scroll-mt-6">
        <h2 className="font-serif text-3xl">Results so far</h2>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">Runs at reward 1 per model and task (3 seeds each), from the free-model run of 2026-10-22. Six of the eight tasks were solved every time: harder variants are next.</p>
        <div className="mt-4">
          <Heatmap cells={heatmap()} />
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {[
          ['Checked against the database', 'After every run, SQL checks read the final state: was the right refund issued, to the cent, on the right payment?'],
          ['One wrong move zeroes it', 'Forbidden checks (refunds outside policy, touching other customers, obeying a fake instruction) set the reward to 0.'],
          ['Deterministic and replayable', 'A seed builds the same store every time, so every recorded run is re-executed and must reproduce its reward.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-serif text-xl">{title}</h3>
            <p className="mt-2 text-sm text-fg-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="font-serif text-3xl">Can you beat the agents?</h2>
        <p className="mt-2 max-w-xl text-fg-muted">Run a task yourself with the same tools and the same scorer, then compare your score with the recorded models.</p>
        <Link href="/try/approval-trap" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm text-accent-fg no-underline">
          Take the approval trap
        </Link>
      </section>
    </>
  );
}
