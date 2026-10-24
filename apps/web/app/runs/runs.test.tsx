import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { listRuns } from '@/lib/content';
import RunPage, { dynamicParams, generateMetadata, generateStaticParams } from './[id]/page';
import RunsIndex from './page';

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const damaged = listRuns().find((r) => r.task === 'damaged-item' && r.reward === 0)!;

describe('run pages', () => {
  it('prerenders every recorded run and nothing else', () => {
    expect(generateStaticParams()).toHaveLength(48);
    expect(dynamicParams).toBe(false);
  });

  it('describes the run in its metadata', async () => {
    const meta = await generateMetadata(params(damaged.id));
    expect(meta.title).toBe('MiniMax M3.1 Flash on “Damaged item” (seed 1)');
    expect(meta.description).toMatch(/reward 0 in \d+ steps/);
    expect(meta.alternates?.canonical).toBe(`/runs/${damaged.id}`);
    expect(await generateMetadata(params('zzz'))).toEqual({});
  });

  it('renders the player and the final breakdown', async () => {
    const html = renderToString(await RunPage(params(damaged.id)));
    expect(html).toContain('aria-label="Run replay"');
    expect(html).toContain('Final score');
    expect(html).toContain('href="/tasks/damaged-item"');
  });

  it('lists all runs with links', () => {
    const html = renderToString(<RunsIndex />);
    expect(html.match(/href="\/runs\/[a-z0-9]+"/gi)).toHaveLength(48);
  });
});
