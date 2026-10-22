import { describe, expect, it } from 'vitest';
import { constraintMessage, EnvError, InfraError, ToolError } from './errors';

describe('errors', () => {
  it('classifies Postgres integrity violations and Prisma constraint codes', () => {
    const check = { code: 'P2039', meta: { driverAdapterError: { cause: { code: '23514', message: 'violates check constraint "products_values_check"' } } } };
    expect(constraintMessage(check)).toMatch(/products_values_check/);
    expect(constraintMessage({ code: 'P2003' })).toMatch(/P2003/);
    expect(constraintMessage(new Error('connection refused'))).toBeNull();
    expect(constraintMessage(null)).toBeNull();
  });
  it('has distinct error classes', () => {
    expect(new ToolError('x')).toBeInstanceOf(Error);
    expect(new InfraError('x', { cause: 1 }).cause).toBe(1);
    expect(new EnvError('not_found', 'nope').code).toBe('not_found');
  });
});
