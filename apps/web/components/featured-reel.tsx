'use client';

import type { Replay } from '@backoffice-gym/replay';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ArrowRightIcon } from './icons';
import { Player } from './player/player';

export interface ReelItem {
  id: string;
  replay: Replay;
  notes: Record<number, string>;
  headline: string;
  caption: string;
}

export function FeaturedReel({ items }: { items: ReelItem[] }) {
  const [i, setI] = useState(0);
  const next = useCallback(() => setI((n) => (n + 1) % items.length), [items.length]);
  const item = items[i]!;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-3xl leading-tight text-balance">{item.headline}</h2>
          <p className="mt-1 text-sm text-fg-meta">{item.caption}</p>
        </div>
        <div className="-mr-2 flex" role="group" aria-label="Featured runs">
          {items.map((it, n) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Show featured run ${n + 1}: ${it.headline}`}
              aria-pressed={n === i}
              onClick={() => setI(n)}
              className="group grid size-8 place-items-center"
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${n === i ? 'w-6 bg-accent' : 'w-2 bg-border group-hover:bg-fg-meta'}`} />
            </button>
          ))}
        </div>
      </div>
      <Player key={item.id} replay={item.replay} notes={item.notes} mode="compact" autoplay startAt="start" onEnded={next} />
      <p className="mt-2 text-sm">
        <Link href={`/runs/${item.id}`} className="inline-flex items-center gap-1.5">
          Open this run step by step <ArrowRightIcon className="size-3.5" />
        </Link>
      </p>
    </div>
  );
}
