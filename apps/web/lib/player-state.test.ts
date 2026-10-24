import { describe, expect, it } from 'vitest';
import { initialPlayer, parseStepParam, playerReducer, shouldAutoplay } from './player-state';

describe('player state', () => {
  it('plays, ticks to the end and stops', () => {
    let s = playerReducer(initialPlayer(3, 0), { type: 'play' });
    expect(s).toMatchObject({ playing: true, step: 0 });
    s = playerReducer(playerReducer(playerReducer(s, { type: 'tick' }), { type: 'tick' }), { type: 'tick' });
    expect(s).toMatchObject({ step: 3, playing: false, ended: true });
    expect(playerReducer(s, { type: 'tick' })).toBe(s);
  });
  it('restarts from the beginning when played at the end', () => {
    expect(playerReducer(initialPlayer(3, 3), { type: 'play' })).toMatchObject({ step: 0, playing: true, ended: false });
  });
  it('steps, seeks and clamps, pausing playback', () => {
    const playing = playerReducer(initialPlayer(5, 2), { type: 'play' });
    expect(playerReducer(playing, { type: 'next' })).toMatchObject({ step: 3, playing: false });
    expect(playerReducer(initialPlayer(5, 0), { type: 'prev' }).step).toBe(0);
    expect(playerReducer(initialPlayer(5, 0), { type: 'seek', step: 99 }).step).toBe(5);
    expect(playerReducer(initialPlayer(5, 0), { type: 'seek', step: 2.7 }).step).toBe(2);
    expect(playerReducer(playing, { type: 'toggle' }).playing).toBe(false);
    expect(playerReducer(initialPlayer(0, 0), { type: 'play' }).playing).toBe(false);
  });
  it('parses ?step= safely', () => {
    expect(parseStepParam('?step=9', 12)).toBe(9);
    expect(parseStepParam('?step=0', 12)).toBe(0);
    for (const bad of ['', '?step=', '?step=abc', '?step=1.5', '?step=-1', '?step=99', '?x=1']) expect(parseStepParam(bad, 12), bad).toBeNull();
    expect(parseStepParam('?step=3&step=4', 12)).toBe(3);
  });
  it('never autoplays for reduced motion', () => {
    expect(shouldAutoplay(true, false)).toBe(true);
    expect(shouldAutoplay(true, true)).toBe(false);
    expect(shouldAutoplay(false, false)).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('ignores keys typed into form fields and never throws on non-element targets', async () => {
    const { isTypingTarget } = await import('./player-state');
    const field = { closest: (sel: string) => (sel.includes('input') ? {} : null) };
    const plain = { closest: () => null };
    expect(isTypingTarget(field as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget(plain as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
