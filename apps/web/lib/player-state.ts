export interface PlayerState {
  step: number;
  total: number;
  playing: boolean;
  ended: boolean;
}

export type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; step: number }
  | { type: 'tick' };

const clamp = (n: number, total: number): number => Math.max(0, Math.min(Math.trunc(n), total));

export const initialPlayer = (total: number, step: number): PlayerState => ({ step: clamp(step, total), total, playing: false, ended: false });

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'play':
      return { ...s, playing: s.total > 0, ended: false, step: s.step >= s.total ? 0 : s.step };
    case 'pause':
      return { ...s, playing: false };
    case 'toggle':
      return playerReducer(s, { type: s.playing ? 'pause' : 'play' });
    case 'next':
      return { ...s, playing: false, step: clamp(s.step + 1, s.total) };
    case 'prev':
      return { ...s, playing: false, step: clamp(s.step - 1, s.total) };
    case 'seek':
      return { ...s, playing: false, step: clamp(a.step, s.total) };
    case 'tick': {
      if (!s.playing) return s;
      const step = clamp(s.step + 1, s.total);
      return step >= s.total ? { ...s, step, playing: false, ended: true } : { ...s, step };
    }
  }
}

/** The `step` query value if it is a whole number within 0..total; otherwise null. */
export function parseStepParam(search: string, total: number): number | null {
  const raw = new URLSearchParams(search).get('step');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n <= total ? n : null;
}

export const shouldAutoplay = (autoplay: boolean, reducedMotion: boolean): boolean => autoplay && !reducedMotion;

/** True when a key event comes from a form control, so player shortcuts must not react. Safe for any event target. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null;
  return typeof el?.closest === 'function' && el.closest('input, textarea, select, [contenteditable]') != null;
}

/** Player shortcuts skip form fields entirely, and skip Space on a focused button (which already activates it). */
export function shouldIgnoreKey(key: string, target: EventTarget | null): boolean {
  if (isTypingTarget(target)) return true;
  const el = target as { closest?: (selector: string) => unknown } | null;
  return key === ' ' && typeof el?.closest === 'function' && el.closest('button') != null;
}
