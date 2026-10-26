import type { MetadataRoute } from 'next';
import { site } from './site';

/** robots.txt: production allows crawling (except the API); preview deployments block everything. */
export function robotsFor(indexable: boolean): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' }, sitemap: `${site.url}/sitemap.xml` };
}
