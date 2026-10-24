import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { site } from '@/lib/site';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

describe('site chrome', () => {
  it('links every section and the repo', () => {
    const html = renderToString(<SiteHeader />);
    for (const href of ['/tasks', '/runs', '/try/damaged-item', '/about', site.repo]) expect(html).toContain(`href="${href}"`);
    expect(html).toContain('BackOffice Gym');
  });
  it('credits the author', () => {
    expect(renderToString(<SiteFooter />)).toContain(site.authorUrl);
  });
});
