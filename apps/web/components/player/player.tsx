'use client';

import type { Replay } from '@backoffice-gym/replay';
import { useEffect, useMemo, useReducer } from 'react';
import { StorePanel } from '@/components/store/store-panel';
import { initialPlayer, parseStepParam, playerReducer, shouldAutoplay } from '@/lib/player-state';
import { changedAt, firstFailingStep, scoreAt, stateAt } from '@/lib/replay-state';
import { AgentPanel } from './agent-panel';
import { Scorecard } from './scorecard';
import { Scrubber } from './scrubber';

export interface PlayerProps {
  replay: Replay;
  notes?: Record<number, string>;
  mode?: 'full' | 'compact';
  autoplay?: boolean;
  /** Where the first render starts: the final step (informative HTML) or the beginning. */
  startAt?: 'start' | 'end';
  onEnded?: () => void;
}

export function Player({ replay, notes = {}, mode = 'full', autoplay = false, startAt = 'end', onEnded }: PlayerProps) {
  const total = replay.steps.length;
  const [s, dispatch] = useReducer(playerReducer, initialPlayer(total, startAt === 'end' ? total : 0));

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (shouldAutoplay(autoplay, reduced)) dispatch({ type: 'play' });
  }, [autoplay, replay]);

  useEffect(() => {
    if (mode !== 'full') return;
    const step = parseStepParam(window.location.search, total);
    if (step !== null) dispatch({ type: 'seek', step });
  }, [mode, total]);

  useEffect(() => {
    if (!s.playing) return;
    const timer = setInterval(() => dispatch({ type: 'tick' }), mode === 'compact' ? 1600 : 1400);
    return () => clearInterval(timer);
  }, [s.playing, mode]);

  useEffect(() => {
    if (!s.ended || !onEnded) return;
    const timer = setTimeout(onEnded, 2500);
    return () => clearTimeout(timer);
  }, [s.ended, onEnded]);

  useEffect(() => {
    if (mode !== 'full') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, button, [contenteditable]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'toggle' });
      } else if (e.key === 'ArrowRight') dispatch({ type: 'next' });
      else if (e.key === 'ArrowLeft') dispatch({ type: 'prev' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'full') return;
    const url = new URL(window.location.href);
    url.searchParams.set('step', String(s.step));
    window.history.replaceState(null, '', url);
  }, [s.step, mode]);

  const state = useMemo(() => stateAt(replay, s.step), [replay, s.step]);
  const changed = useMemo(() => changedAt(replay, s.step), [replay, s.step]);
  const failAt = useMemo(() => firstFailingStep(replay), [replay]);

  return (
    <section aria-label="Run replay">
      <div className={mode === 'full' ? 'grid gap-4 lg:grid-cols-[1.35fr_1fr]' : 'grid gap-3 md:grid-cols-[1.35fr_1fr]'}>
        <StorePanel state={state} changed={changed} />
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <AgentPanel replay={replay} step={s.step} note={notes[s.step]} />
          <Scorecard replay={replay} step={s.step} score={scoreAt(replay, s.step)} />
        </div>
      </div>
      <Scrubber
        replay={replay}
        step={s.step}
        playing={s.playing}
        failAt={failAt}
        compact={mode === 'compact'}
        onSeek={(n) => dispatch({ type: 'seek', step: n })}
        onToggle={() => dispatch({ type: 'toggle' })}
      />
    </section>
  );
}
