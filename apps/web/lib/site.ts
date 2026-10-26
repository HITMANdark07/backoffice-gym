type SiteEnv = { NEXT_PUBLIC_SITE_URL?: string; VERCEL_ENV?: string; VERCEL_URL?: string };

/**
 * The canonical origin for links, the sitemap and OG images. Production builds must set NEXT_PUBLIC_SITE_URL;
 * preview deployments fall back to their own address, which Vercel provides as VERCEL_URL.
 */
export function resolveSiteUrl(env: SiteEnv): string {
  const url = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (url) return url;
  const preview = env.VERCEL_ENV === 'preview' ? env.VERCEL_URL?.trim() : undefined;
  if (preview) return `https://${preview}`;
  if (env.VERCEL_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must be set for production builds: canonical URLs, the sitemap and OG images use it.');
  }
  return 'http://localhost:3100';
}

/** Preview deployments stay out of search engines; production and local builds are indexable. */
export function isIndexable(env: Pick<SiteEnv, 'VERCEL_ENV'>): boolean {
  return env.VERCEL_ENV !== 'preview';
}

export const site = {
  name: 'BackOffice Gym',
  tagline: 'An RL environment where AI agents run a store.',
  description:
    'An open-source RL environment where AI agents run the back office of a fictional store. Rewards come from SQL checks on the final database state, with trap tasks and replayable runs.',
  // Read as literals so Next inlines NEXT_PUBLIC_SITE_URL into client bundles.
  url: resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_ENV: process.env.VERCEL_ENV, VERCEL_URL: process.env.VERCEL_URL }),
  indexable: isIndexable({ VERCEL_ENV: process.env.VERCEL_ENV }),
  repo: 'https://github.com/HITMANdark07/backoffice-gym',
  author: 'Shekhar Kumar',
  authorUrl: 'https://www.shekharkumar.com',
} as const;
