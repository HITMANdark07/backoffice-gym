/** A problem the agent caused: bad arguments or a failed precondition. Returned to the agent and counted as a step. */
export class ToolError extends Error {
  override name = 'ToolError';
}

/** The environment's infrastructure failed (database down, timeout). Never counted against the agent. */
export class InfraError extends Error {
  override name = 'InfraError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export type EnvErrorCode = 'unknown_task' | 'bad_seed' | 'not_found';

/** A caller error at the environment level (not a step): unknown task, bad seed, unknown episode. */
export class EnvError extends Error {
  override name = 'EnvError';
  constructor(
    readonly code: EnvErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const PRISMA_CONSTRAINT_CODES = new Set(['P2002', 'P2003', 'P2004', 'P2011']);

/** A message for the agent when `e` is a database integrity violation it caused; otherwise null. */
export function constraintMessage(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  const err = e as { code?: unknown; meta?: { driverAdapterError?: { cause?: { code?: unknown; message?: unknown } } } };
  const pg = err.meta?.driverAdapterError?.cause;
  if (typeof pg?.code === 'string' && pg.code.startsWith('23')) {
    return `the database rejected the change: ${String(pg.message ?? pg.code)}`;
  }
  if (typeof err.code === 'string' && PRISMA_CONSTRAINT_CODES.has(err.code)) {
    return `the database rejected the change (${err.code})`;
  }
  return null;
}
