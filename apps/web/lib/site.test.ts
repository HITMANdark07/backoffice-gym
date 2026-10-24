import { describe, expect, it } from 'vitest';
import { resolveSiteUrl } from './site';

describe('resolveSiteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://backoffice-gym.vercel.app/' })).toBe('https://backoffice-gym.vercel.app');
  });

  it('defaults to the local dev server outside production', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3100');
    expect(resolveSiteUrl({ VERCEL_ENV: 'preview' })).toBe('http://localhost:3100');
  });

  it('fails a production build that has no site URL, instead of shipping localhost links', () => {
    expect(() => resolveSiteUrl({ VERCEL_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteUrl({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: '  ' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
