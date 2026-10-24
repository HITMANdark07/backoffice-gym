/**
 * The visitor's address for rate limiting. On Vercel, x-real-ip is set by the platform; x-forwarded-for is
 * the fallback for other proxies. Requests without either share one "unknown" bucket.
 */
export function clientIpFromHeaders(get: (name: string) => string | undefined): string {
  const real = get('x-real-ip')?.trim();
  if (real) return real;
  const first = get('x-forwarded-for')?.split(',')[0]?.trim();
  return first || 'unknown';
}
