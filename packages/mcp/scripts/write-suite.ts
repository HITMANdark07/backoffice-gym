// Writes evals/shopgym.yaml (free models, 8 tasks × seeds 1–3) and the offline suite + mock script for a no-network check.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TASKS } from '@shopgym/core';
import { buildSuiteYaml, FREE_MODELS } from '../src/suite';

const evals = fileURLToPath(new URL('../../../evals/', import.meta.url));
mkdirSync(`${evals}offline`, { recursive: true });

writeFileSync(`${evals}shopgym.yaml`, buildSuiteYaml({ models: FREE_MODELS, seeds: [1, 2, 3] }));

const OFFLINE = ['damaged-item', 'refund-window-trap', 'injection-trap'];
writeFileSync(
  `${evals}offline/shopgym-offline.yaml`,
  buildSuiteYaml({ models: [{ id: 'mock/perfect' }], seeds: [1], slugs: OFFLINE, name: 'shopgym-offline', serverPath: '{suite_dir}/../../packages/mcp/bin/shopgym-mcp.mjs' }),
);

/** Perfect plays for seed 1, built from each instance's hidden expected outcome (offline check only). */
const entries = OFFLINE.map((slug) => {
  const inst = TASKS.find((t) => t.slug === slug)!.generate(1);
  const e = inst.expected as { thread_id: number; order_id: number; in_stock?: boolean; sku?: string; refund_cents?: number };
  const act =
    slug === 'damaged-item'
      ? e.in_stock
        ? { name: 'create_replacement', arguments: { order_id: e.order_id, sku: e.sku, qty: 1 } }
        : { name: 'issue_refund', arguments: { order_id: e.order_id, amount: (e.refund_cents ?? 0) / 100, reason: 'damaged on arrival' } }
      : null;
  const reply =
    slug === 'damaged-item'
      ? `Sorry about that. We've taken care of order #${e.order_id}.`
      : 'Sorry, our policy only allows refunds within 30 days of delivery, so we cannot refund this order.';
  return {
    match: inst.prompt,
    steps: [
      { toolCalls: [{ name: 'read_policy', arguments: {} }] },
      ...(act ? [{ toolCalls: [act] }] : []),
      { toolCalls: [{ name: 'reply_to_thread', arguments: { thread_id: e.thread_id, body: reply } }] },
      { toolCalls: [{ name: 'submit', arguments: { summary: 'done' } }] },
      { content: 'Handled the thread and submitted.' },
    ],
  };
});
writeFileSync(`${evals}offline/mock-script.json`, `${JSON.stringify({ entries }, null, 2)}\n`);
console.log('wrote evals/shopgym.yaml, evals/offline/shopgym-offline.yaml, evals/offline/mock-script.json');
