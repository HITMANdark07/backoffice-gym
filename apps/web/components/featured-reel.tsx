'use client';

import type { Replay } from '@backoffice-gym/replay';
import Link from 'next/link';
import { useCallback, useState } from 'react';
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
          <p className="text-xs uppercase tracking-wider text-accent">{item.caption}</p>
          <p className="font-serif text-2xl">{item.headline}</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Featured runs">
          {items.map((it, n) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Show featured run ${n + 1}: ${it.headline}`}
              aria-pressed={n === i}
              onClick={() => setI(n)}
              className={`size-2.5 rounded-full ${n === i ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
      </div>
      <Player key={item.id} replay={item.replay} notes={item.notes} mode="compact" autoplay startAt="start" onEnded={next} />
      <p className="mt-2 text-sm">
        <Link href={`/runs/${item.id}`}>Open this run step by step →</Link>
      </p>
    </div>
  );
}
