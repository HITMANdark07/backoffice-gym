import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, rateLimitKey } from './client-ip';

const from = (h: Record<string, string>) => (name: string) => h[name];

describe('clientIpFromHeaders', () => {
  it('prefers x-real-ip, which Vercel sets and visitors cannot override', () => {
    expect(clientIpFromHeaders(from({ 'x-real-ip': '198.51.100.4', 'x-forwarded-for': '203.0.113.9' }))).toBe('198.51.100.4');
  });

  it('falls back to the first x-forwarded-for entry, trimmed', () => {
    expect(clientIpFromHeaders(from({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' }))).toBe('203.0.113.9');
  });

  it('ignores blank headers and returns "unknown" when there is no address', () => {
    expect(clientIpFromHeaders(from({ 'x-real-ip': '  ', 'x-forwarded-for': '' }))).toBe('unknown');
    expect(clientIpFromHeaders(from({}))).toBe('unknown');
  });
});

describe('rateLimitKey', () => {
  it('keeps IPv4 addresses and placeholders as they are', () => {
    expect(rateLimitKey('203.0.113.9')).toBe('203.0.113.9');
    expect(rateLimitKey('unknown')).toBe('unknown');
  });

  it('groups IPv6 addresses by their /64, so rotating within one network does not reset the limit', () => {
    expect(rateLimitKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(rateLimitKey('2001:db8:1:2:ffff::1')).toBe('2001:db8:1:2::/64');
    expect(rateLimitKey('2001:DB8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('treats IPv4-mapped IPv6 addresses as IPv4', () => {
    expect(rateLimitKey('::ffff:198.51.100.4')).toBe('198.51.100.4');
  });

  it('leaves values that are not valid IPv6 unchanged', () => {
    expect(rateLimitKey('zz::1')).toBe('zz::1');
    expect(rateLimitKey('1::2::3')).toBe('1::2::3');
    expect(rateLimitKey('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9');
  });
});
