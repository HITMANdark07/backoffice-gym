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

/**
 * The key the rate limiter counts under. One IPv6 network usually gets a whole /64, so IPv6
 * addresses are grouped by it; anything else (IPv4, "unknown", malformed values) is kept as is.
 */
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const addr = ip.split('%')[0]!.toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (mapped) return mapped[1]!;
  const halves = addr.split('::');
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return ip;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}
