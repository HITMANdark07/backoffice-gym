import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createEnv } from '@backoffice-gym/core';
import { createDb, devDatabaseUrl } from '@backoffice-gym/db';
import { replayTrace, ReplayMismatchError } from './replay';
import { readTraces } from './traces';

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  const v = i === -1 ? undefined : process.argv[i + 1];
  if (!v) {
    console.error('usage: pnpm replay --traces <traces.jsonl[.gz]> --out <dir>');
    process.exit(64);
  }
  return v;
}

const tracesPath = resolve(process.env.INIT_CWD ?? process.cwd(), arg('--traces'));
const outDir = resolve(process.env.INIT_CWD ?? process.cwd(), arg('--out'));
const db = createDb(devDatabaseUrl());
const env = createEnv(db);
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '_');

mkdirSync(outDir, { recursive: true });
const index: Array<{ file: string; model: string; task: string; seed: number; reward: number; recorded: number | null }> = [];
let mismatches = 0;
try {
  for (const trace of await readTraces(tracesPath)) {
    if (trace.outcome === 'error') continue;
    try {
      const replay = await replayTrace(env, db, trace);
      const file = `${safe(trace.runKey)}.json`;
      writeFileSync(join(outDir, file), `${JSON.stringify(replay, null, 2)}\n`);
      index.push({ file, model: replay.run.model, task: replay.run.task, seed: replay.run.seed, reward: replay.score.reward, recorded: replay.run.recorded_reward });
    } catch (e) {
      if (!(e instanceof ReplayMismatchError)) throw e;
      mismatches++;
      console.error(e.message);
    }
  }
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`replayed ${index.length} run(s) into ${outDir}; ${mismatches} mismatch(es)`);
} finally {
  await db.$disconnect();
}
process.exit(mismatches > 0 ? 1 : 0);
