import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders } from './client-ip';

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
