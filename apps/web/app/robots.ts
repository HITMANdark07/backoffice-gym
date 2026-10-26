import type { MetadataRoute } from 'next';
import { robotsFor } from '@/lib/robots';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return robotsFor(site.indexable);
}
