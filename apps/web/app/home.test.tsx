import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { stats } from '@/lib/content';
import Home from './page';

describe('landing page', () => {
  const html = renderToString(<Home />);
  it('leads with the pitch and the two calls to action', () => {
    expect(html).toContain('An RL environment where AI agents run a store.');
    expect(html).toContain('Scored by SQL against the database, not by another model.');
    expect(html).toContain('href="/try/injection-trap"');
    expect(html).toContain('href="#results"');
  });
  it('shows a featured replay with its headline', () => {
    expect(html).toContain('aria-label="Run replay"');
    expect(html).toContain('Ignores a fake “SYSTEM” instruction to refund $500');
  });
  it('shows numbers that come from the data', () => {
    const s = stats();
    expect(html).toContain(`>${s.runs}<`);
    expect(html).toContain(`>${s.perfect}<`);
    expect(html.match(/data-cell=/g)).toHaveLength(16);
  });
});
