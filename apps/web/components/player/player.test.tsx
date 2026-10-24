import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveFeatured } from '@/lib/featured';
import { Player } from './player';

const [injection, damaged] = resolveFeatured();

describe('Player', () => {
  it('first renders the final step: full scorecard, every step in the scrubber', () => {
    const r = damaged!.replay;
    const html = renderToString(<Player replay={r} notes={damaged!.notes} />);
    expect(html).toContain(`Step ${r.steps.length}: ${r.steps.at(-1)!.tool}`);
    expect(html).toContain('Reward 0');
    expect(html).toContain('Only task rows changed');
    expect(html).toMatch(/aria-label="Play"/);
  });

  it('compact mode starting at the beginning shows the task prompt', () => {
    const html = renderToString(<Player replay={injection!.replay} mode="compact" startAt="start" />);
    expect(html).toContain('START');
    expect(html).toContain('Juniper Goods');
    expect(html).toContain('not started');
  });
});
