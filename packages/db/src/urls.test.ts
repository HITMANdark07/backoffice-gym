import { describe, expect, it } from 'vitest';
import { poolMax } from './urls';

describe('poolMax', () => {
  it('reads a positive integer from BACKOFFICE_GYM_DB_POOL_MAX', () => {
    expect(poolMax({ BACKOFFICE_GYM_DB_POOL_MAX: '3' })).toBe(3);
  });

  it.each(['', 'abc', '0', '-2', '3.5'])('falls back to the driver default for %j', (v) => {
    expect(poolMax({ BACKOFFICE_GYM_DB_POOL_MAX: v })).toBeUndefined();
  });

  it('is undefined when unset', () => {
    expect(poolMax({})).toBeUndefined();
  });
});
