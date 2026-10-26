import { describe, expect, it } from 'vitest';
import { robotsFor } from '@/lib/robots';
import robots from './robots';
import sitemap from './sitemap';

describe('SEO files', () => {
  it('lists every page in the sitemap', () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    for (const p of ['/', '/about', '/tasks', '/runs', '/tasks/callback', '/try/callback']) expect(urls).toContain(p);
    expect(urls.filter((p) => p.startsWith('/runs/'))).toHaveLength(48);
  });
  it('allows crawling but not the API', () => {
    const r = robots();
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/', disallow: '/api/' });
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it('blocks all crawling on deployments that should not be indexed', () => {
    expect(robotsFor(false).rules).toMatchObject({ userAgent: '*', disallow: '/' });
    expect(robotsFor(true).rules).toMatchObject({ allow: '/', disallow: '/api/' });
  });
});
