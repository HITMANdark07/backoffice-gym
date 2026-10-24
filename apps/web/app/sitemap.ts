import { TASKS } from '@backoffice-gym/core';
import type { MetadataRoute } from 'next';
import { listRuns } from '@/lib/content';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${site.url}${path}`;
  return [
    ...['/', '/about', '/tasks', '/runs'].map((p) => ({ url: url(p) })),
    ...TASKS.flatMap((t) => [{ url: url(`/tasks/${t.slug}`) }, { url: url(`/try/${t.slug}`) }]),
    ...listRuns().map((r) => ({ url: url(`/runs/${r.id}`) })),
  ];
}
