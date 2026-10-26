import { describe, expect, it } from 'vitest';
import { isIndexable, resolveSiteUrl } from './site';

describe('resolveSiteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://backoffice-gym.vercel.app/' })).toBe('https://backoffice-gym.vercel.app');
  });

  it('defaults to the local dev server outside production', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3100');
    expect(resolveSiteUrl({ VERCEL_ENV: 'preview' })).toBe('http://localhost:3100');
  });

  it("uses a preview deployment's own address when no site URL is set", () => {
    expect(resolveSiteUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'backoffice-gym-git-x-hitman.vercel.app' })).toBe('https://backoffice-gym-git-x-hitman.vercel.app');
    expect(resolveSiteUrl({ VERCEL_ENV: 'preview', VERCEL_URL: '  ' })).toBe('http://localhost:3100');
    expect(resolveSiteUrl({ VERCEL_ENV: 'production', VERCEL_URL: 'x.vercel.app', NEXT_PUBLIC_SITE_URL: 'https://a.example' })).toBe('https://a.example');
  });

  it('fails a production build that has no site URL, instead of shipping localhost links', () => {
    expect(() => resolveSiteUrl({ VERCEL_ENV: 'production' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => resolveSiteUrl({ VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: '  ' })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

describe('isIndexable', () => {
  it('keeps preview deployments out of search engines', () => {
    expect(isIndexable({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isIndexable({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isIndexable({})).toBe(true);
  });
});
