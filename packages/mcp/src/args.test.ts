import { describe, expect, it } from 'vitest';
import { parseArgs, UsageError } from './args';

describe('parseArgs', () => {
  it('reads task, seed and database url', () => {
    expect(parseArgs(['--task', 'damaged-item', '--seed', '7'])).toEqual({ task: 'damaged-item', seed: 7 });
    expect(parseArgs(['--seed', '0', '--task', 'callback', '--database-url', 'postgresql://x/y'])).toEqual({ task: 'callback', seed: 0, databaseUrl: 'postgresql://x/y' });
  });
  it('rejects missing, unknown and malformed arguments', () => {
    for (const argv of [[], ['--task', 'x'], ['--task', 'x', '--seed', '-1'], ['--task', 'x', '--seed', '1.5'], ['--task', '--seed', '1'], ['--task', 'x', '--seed', '1', '--port', '9']]) {
      expect(() => parseArgs(argv), argv.join(' ')).toThrow(UsageError);
    }
  });
});
