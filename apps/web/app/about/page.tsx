import type { Metadata } from 'next';
import { MAX_STEPS, TOOLS } from '@backoffice-gym/core';
import { stats } from '@/lib/content';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'How BackOffice Gym works: seeded episodes, SQL-checked rewards, the MCP and RL interfaces, and the limitations.',
};

const PYTHON = `from backoffice_gym import BackOfficeGym

with BackOfficeGym("http://127.0.0.1:8787") as env:   # pnpm api
    obs = env.reset("refund-window-trap", seed=7)
    result, done = env.step("read_policy")
    ...
    result, done = env.step("submit", {"summary": "declined per policy"})
    print(result["score"]["reward"])`;

export default function AboutPage() {
  return (
    <article className="max-w-3xl py-8">
      <h1 className="font-serif text-5xl">About</h1>
      <p className="mt-4 text-lg text-fg-muted">
        {site.name} is an open-source reinforcement-learning environment. An agent runs the operations desk of Juniper Goods, a fictional online home-goods store: support threads, refunds, replacements, restocking, a staff calendar and a written policy.
      </p>

      <h2 className="mt-10 font-serif text-3xl">How an episode works</h2>
      <p className="mt-2">
        A task template and a seed generate a fresh store in PostgreSQL: customers, orders, payments, inventory, calendar and an open support thread. {`The agent gets ${TOOLS.length} tools (${TOOLS.filter((t) => t.kind === 'read').length} to read, ${TOOLS.filter((t) => t.kind === 'act').length} to act, and submit) and at most ${MAX_STEPS} steps.`} The same task and seed always produce the same store.
      </p>

      <h2 className="mt-8 font-serif text-3xl">How the reward is decided</h2>
      <p className="mt-2">
        When the agent submits, SQL checks read the final database state and compare it with the outcome the seed implies. Required checks are weighted. Forbidden checks (a change outside the task, a refund that breaks policy, obeying a fake instruction) set the reward to 0. No language model judges anything.
      </p>

      <h2 className="mt-8 font-serif text-3xl">Ways in</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>An MCP server (one episode per session), used by mcp-evals to run and score agents.</li>
        <li>An HTTP RL API: reset, step, score.</li>
        <li>A small Python client:</li>
      </ul>
      <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-sm">{PYTHON}</pre>
      <p className="mt-3">
        Runs on this site were recorded with <a href="https://github.com/HITMANdark07/mcp-evals">mcp-evals</a>, then re-executed step by step: every replay reproduced its recorded reward exactly.
      </p>

      <h2 className="mt-8 font-serif text-3xl">Limitations</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{`${stats().tasks} tasks in one store. ${stats().perfectTasks} of them were solved every time by the ${stats().models} models tested, so harder variants are needed.`}</li>
        <li>One repeat per task and seed: the intervals are wide.</li>
        <li>Reply checks look for facts (an order number, the 30-day rule), not tone.</li>
        <li>The author of the environment also wrote the harness that scores it; all tasks, checks and traces are public.</li>
      </ul>

      <p className="mt-10 text-sm text-fg-meta">
        Built by <a href={site.authorUrl}>{site.author}</a> · <a href={site.repo}>source on GitHub</a>
      </p>
    </article>
  );
}
