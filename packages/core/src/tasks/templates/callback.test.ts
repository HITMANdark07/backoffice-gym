import { afterAll, describe, expect, it } from 'vitest';
import { createEnv } from '../../episode/env';
import { testDb } from '../../test/db';
import { expectedOf, play } from '../../test/env';
import { toolSchemas } from '../../tools/index';
import { callback, type CallbackExpected } from './callback';

const db = testDb();
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function start(seed = 1) {
  const r = await env.reset({ task: 'callback', seed });
  return { id: r.episode_id, e: await expectedOf<CallbackExpected>(db, r.episode_id) };
}
/** `minutes` after the start of window `w`, as YYYY-MM-DDTHH:mm. */
const plus = (e: CallbackExpected, w: number, minutes: number) => new Date(Date.parse(`${e.windows[w]!.start}:00Z`) + minutes * 60_000).toISOString().slice(0, 16);

describe('callback', () => {
  it('always leaves a free slot in window 2 for staff 1', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { rows, expected } = callback.generate(seed);
      const slotStart = Date.parse(`${expected.windows[1]!.start}:00Z`) + 3_600_000;
      const busy = rows.calendar_events.some((ev) => ev.staff_id === 1 && ev.starts_at.getTime() < slotStart + 1_800_000 && ev.ends_at.getTime() > slotStart);
      expect(busy, `seed ${seed}`).toBe(false);
    }
  });

  it('a 30-minute slot with on-duty support staff inside a window, with the time in the reply, scores 1', async () => {
    const { id, e } = await start();
    const startsAt = plus(e, 1, 60);
    const res = await play(env, id, [
      ['schedule_event', { staff_id: 1, starts_at: startsAt, minutes: 30, title: 'Customer callback', customer_id: e.customer_id }],
      ['reply_to_thread', { thread_id: e.thread_id, body: `We'll call you at ${startsAt.slice(11)} IST.` }],
      ['submit', {}],
    ]);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('accepts 12-hour times in the reply', async () => {
    const { id, e } = await start(2);
    const startsAt = plus(e, 1, 60);
    const h = Number(startsAt.slice(11, 13));
    const twelve = `${h > 12 ? h - 12 : h}:${startsAt.slice(14, 16)} ${h >= 12 ? 'PM' : 'AM'}`;
    const res = await play(env, id, [['schedule_event', { staff_id: 1, starts_at: startsAt, minutes: 30, title: 'Callback', customer_id: e.customer_id }], ['reply_to_thread', { thread_id: e.thread_id, body: `Booked for ${twelve}.` }], ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('booking over a busy slot, the wrong person or the wrong length fails valid-callback', async () => {
    for (const [staff, at, minutes] of [[1, 0, 30], [4, 60, 30], [1, 60, 60]] as const) {
      const { id, e } = await start();
      const startsAt = plus(e, at === 0 ? 0 : 1, at);
      const res = await play(env, id, [['schedule_event', { staff_id: staff, starts_at: startsAt, minutes, title: 'Callback', customer_id: e.customer_id }], ['reply_to_thread', { thread_id: e.thread_id, body: `See you at ${startsAt.slice(11)}.` }], ['submit', {}]]);
      expect(res.at(-1)?.score?.checks.find((c) => c.id === 'valid-callback')?.passed, `${staff}/${at}/${minutes}`).toBe(false);
    }
  });

  it('doing nothing scores 0', async () => {
    const { id } = await start();
    expect((await env.step(id, { tool: 'submit', args: {} })).score?.reward).toBe(0);
  });
});

describe('callback: the agent is told to link the event', () => {
  it('policy rule 7 and the schedule_event schema both say to link the customer', async () => {
    const { id } = await start();
    const policy = (await env.step(id, { tool: 'read_policy', args: {} })).result as { policy: string };
    expect(policy.policy).toMatch(/7\. \*\*Callbacks\.\*\*[^\n]*link the event to the customer/i);
    const schema = toolSchemas().find((t) => t.name === 'schedule_event')!.input_schema as { properties: { customer_id: { description?: string } } };
    expect(schema.properties.customer_id.description).toMatch(/customer/i);
  });
});
