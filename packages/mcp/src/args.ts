export interface CliArgs {
  task: string;
  seed: number;
  databaseUrl?: string;
}

export class UsageError extends Error {
  override name = 'UsageError';
}

export const USAGE = 'usage: backoffice-gym-mcp --task <slug> --seed <int> [--database-url <url>]';

export function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag !== '--task' && flag !== '--seed' && flag !== '--database-url') throw new UsageError(`unknown argument ${flag}`);
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${flag} needs a value`);
    if (flag === '--task') out.task = value;
    else if (flag === '--seed') {
      if (!/^\d+$/.test(value)) throw new UsageError('--seed must be a non-negative integer');
      out.seed = Number(value);
    } else out.databaseUrl = value;
  }
  if (out.task === undefined || out.seed === undefined) throw new UsageError('--task and --seed are required');
  return out as CliArgs;
}
