import { TASKS } from '@backoffice-gym/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TaskPage, { dynamicParams, generateMetadata, generateStaticParams } from './[slug]/page';
import TasksIndex from './page';

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('task pages', () => {
  it('prerenders the 8 tasks only', () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(TASKS.map((t) => t.slug));
    expect(dynamicParams).toBe(false);
  });

  it('shows the checks (descriptions only), the recorded runs and a try link', async () => {
    const html = renderToString(await TaskPage(params('approval-trap')));
    expect(html).toContain('One manager approval is requested for exactly the item price.');
    expect(html).toContain('Nothing outside the task changes');
    expect(html.match(/href="\/runs\/[a-z0-9]+"/gi)).toHaveLength(6);
    expect(html).toContain('href="/try/approval-trap"');
    expect(html).not.toMatch(/amount_cents|"expected"/);
  });

  it('has metadata, and nothing for unknown slugs', async () => {
    expect((await generateMetadata(params('callback'))).title).toBe('Task: Book a callback');
    expect(await generateMetadata(params('nope'))).toEqual({});
  });

  it('lists all tasks with their pass rates', () => {
    const html = renderToString(<TasksIndex />);
    for (const t of TASKS) expect(html).toContain(`href="/tasks/${t.slug}"`);
    expect(html).toMatch(/\d+\/6 runs at reward 1/);
  });
});
