import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { TraceLike } from './replay';

/** Reads an mcp-evals traces.jsonl (or .jsonl.gz). */
export async function readTraces(path: string): Promise<TraceLike[]> {
  const buf = await readFile(path);
  const text = (path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as TraceLike);
}
