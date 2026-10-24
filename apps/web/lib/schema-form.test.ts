import { describe, expect, it } from 'vitest';
import { argsFrom, describeApiError, fieldsFor } from './schema-form';

const refund = {
  type: 'object',
  properties: { order_id: { type: 'integer' }, amount: { type: 'number' }, reason: { type: 'string', maxLength: 500 }, payment_id: { type: 'integer' } },
  required: ['order_id', 'amount', 'reason'],
};

describe('schema forms', () => {
  it('turns a tool schema into fields', () => {
    expect(fieldsFor(refund)).toEqual([
      { name: 'order_id', type: 'integer', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'reason', type: 'string', required: true },
      { name: 'payment_id', type: 'integer', required: false },
    ]);
    expect(fieldsFor({ type: 'object', properties: { body: { type: 'string', maxLength: 4000 } } })[0]!.type).toBe('text');
    expect(fieldsFor({ type: 'object', properties: { status: { type: 'string', enum: ['open', 'all'] } } })[0]).toMatchObject({ type: 'enum', options: ['open', 'all'] });
    expect(fieldsFor({ type: 'object', properties: { below_threshold: { type: 'boolean' } } })[0]!.type).toBe('boolean');
    expect(fieldsFor({})).toEqual([]);
  });

  it('builds arguments, dropping empty optional fields and converting numbers', () => {
    const fields = fieldsFor(refund);
    expect(argsFrom(fields, { order_id: '1013', amount: '54', reason: 'damaged', payment_id: '' })).toEqual({ order_id: 1013, amount: 54, reason: 'damaged' });
    expect(argsFrom(fieldsFor({ type: 'object', properties: { flag: { type: 'boolean' } } }), { flag: true })).toEqual({ flag: true });
    expect(argsFrom(fieldsFor({ type: 'object', properties: { flag: { type: 'boolean' } } }), { flag: false })).toEqual({});
  });

  it('describes API failures in plain words', () => {
    expect(describeApiError(0, null)).toMatch(/could not reach/i);
    expect(describeApiError(400, { error: 'unknown task "x"' })).toBe('unknown task "x"');
    expect(describeApiError(404, { error: 'episode e not found' })).toMatch(/expired or does not exist/);
    expect(describeApiError(429, {})).toMatch(/too many/i);
    expect(describeApiError(503, {})).toMatch(/database is unavailable/i);
    expect(describeApiError(500, 'oops')).toMatch(/something went wrong/i);
  });
});

describe('episodeClosed', () => {
  it('detects an episode that cannot take more steps', async () => {
    const { episodeClosed } = await import('./schema-form');
    expect(episodeClosed(404, { error: 'episode x not found' })).toBe(true);
    expect(episodeClosed(200, { step: 4, ok: false, error: 'the episode has expired', done: true })).toBe(true);
    expect(episodeClosed(200, { step: 4, ok: true, done: true, score: { reward: 1 } })).toBe(false);
    expect(episodeClosed(200, { step: 2, ok: true, done: false })).toBe(false);
    expect(episodeClosed(503, {})).toBe(false);
  });
});
