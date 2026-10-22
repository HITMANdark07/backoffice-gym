import { TASKS } from '@shopgym/core';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildSuiteYaml, FREE_MODELS, taskId } from './suite';

type Parsed = {
  suite: string;
  servers: { shopgym: { command: string; args: string[]; hidden_tools: string[] } };
  models: Array<{ id: string; provider?: string } | string>;
  tasks: Array<{ id: string; prompt: string; vars: Record<string, string>; graders: unknown[] }>;
};

describe('buildSuiteYaml', () => {
  it('writes one task per template and seed, with literal prompts and vars', () => {
    const doc = parse(buildSuiteYaml({ models: FREE_MODELS, seeds: [1, 2, 3] })) as Parsed;
    expect(doc.suite).toBe('shopgym');
    expect(doc.tasks).toHaveLength(TASKS.length * 3);
    const first = doc.tasks[0]!;
    expect(first.id).toBe(taskId('damaged-item', 1));
    expect(first.prompt).toBe(TASKS[0]!.generate(1).prompt);
    expect(first.vars).toEqual({ task: 'damaged-item', seed: '1' });
    expect(first.graders).toEqual([{ type: 'env_reward', tool: '__score', min: 1 }]);
    expect(doc.servers.shopgym).toMatchObject({ command: 'node', hidden_tools: ['__score'] });
    expect(doc.servers.shopgym.args).toEqual(['{suite_dir}/../packages/mcp/bin/shopgym-mcp.mjs', '--task', '{task}', '--seed', '{seed}']);
  });

  it('keeps every prompt exact through YAML, even with quotes, colons, # and non-ASCII text', () => {
    const doc = parse(buildSuiteYaml({ models: FREE_MODELS, seeds: [1, 2, 3, 4, 5] })) as Parsed;
    for (const t of doc.tasks) {
      const [slug, seed] = [t.vars.task!, Number(t.vars.seed)];
      expect(t.prompt).toBe(TASKS.find((x) => x.slug === slug)!.generate(seed).prompt);
    }
    const tricky = parse(buildSuiteYaml({ models: [{ id: 'mock/x' }], seeds: [1], slugs: ['damaged-item'], promptOverride: 'He said "hi": #1 — नमस्ते\nline 2' })) as Parsed;
    expect(tricky.tasks[0]!.prompt).toBe('He said "hi": #1 — नमस्ते\nline 2');
  });

  it('filters slugs and supports plain mock model ids', () => {
    const doc = parse(buildSuiteYaml({ models: [{ id: 'mock/perfect' }], seeds: [1], slugs: ['callback'], name: 'shopgym-offline', serverPath: '{suite_dir}/../../packages/mcp/bin/shopgym-mcp.mjs' })) as Parsed;
    expect(doc).toMatchObject({ suite: 'shopgym-offline', models: ['mock/perfect'] });
    expect(doc.tasks.map((t) => t.id)).toEqual(['callback--s1']);
    expect(doc.servers.shopgym.args[0]).toBe('{suite_dir}/../../packages/mcp/bin/shopgym-mcp.mjs');
  });
});
