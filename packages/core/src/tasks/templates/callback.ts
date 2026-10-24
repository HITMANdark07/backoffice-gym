import type { Row } from '@backoffice-gym/db';
import { addEvent, addThread } from '../../store/build';
import { generateBaseStore } from '../../store/generate';
import { POLICY_RULES } from '../../store/policy';
import { addDays, at, formatWallTime, hhmm, humanDay } from '../../util/time';
import { added, agentReplies, allow, fail, num, pass, replyRules, str } from '../checks';
import { taskPrompt } from '../prompt';
import type { TaskTemplate } from '../types';

export interface CallbackExpected {
  customer_id: number; thread_id: number;
  /** IST wall times, YYYY-MM-DDTHH:mm. */
  windows: Array<{ start: string; end: string }>;
  support_staff_ids: number[];
}

const SLUG = 'callback';
const wall = (row: Row | undefined, key: string): string => str(row, key).slice(0, 16);
const minutesBetween = (a: string, b: string): number => (Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000;

/** True if the reply states `hh:mm` as 24-hour (14:30, 14.30) or 12-hour (2:30 pm) time. */
function mentionsTime(text: string, time: string): boolean {
  const [hh, mm] = time.split(':') as [string, string];
  const h = Number(hh);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h >= 12 ? 'pm' : 'am';
  return new RegExp(`(^|\\D)${hh}[:.]${mm}(\\D|$)`).test(text) || new RegExp(`(^|\\D)${h12}[:.]${mm}\\s?${suffix}`, 'i').test(text);
}

export const callback: TaskTemplate<CallbackExpected> = {
  slug: SLUG,
  title: 'Book a callback',
  summary: 'A customer asks for a phone call and offers two time windows. Book a valid slot and tell them when.',
  generate(seed) {
    const { rng, rows, storeDate } = generateBaseStore(SLUG, seed);
    const customer = rng.pick(rows.customers);
    const day1 = addDays(storeDate, 1);
    const day2 = addDays(storeDate, 2);
    const h1 = rng.int(10, 13);
    const h2 = rng.int(11, 14);
    const w1 = { start: at(day1, h1), end: at(day1, h1 + 2) };
    const w2 = { start: at(day2, h2), end: at(day2, h2 + 2) };
    const support = rows.staff.filter((s) => s.role === 'support' && s.on_duty);
    for (const s of support) addEvent(rows, { staffId: s.id, title: 'Returns triage', startsAt: w1.start, minutes: 120 });
    const freeFrom = at(day2, h2 + 1);
    rows.calendar_events = rows.calendar_events.filter((ev) => !(ev.staff_id === 1 && ev.starts_at < w2.end && ev.ends_at > freeFrom));
    addEvent(rows, { staffId: 1, title: 'Supplier call', startsAt: w2.start, minutes: 60 });
    const thread = addThread(rows, {
      customerId: customer.id,
      subject: 'Callback request',
      body: `Hi, could someone from your team call me about a delivery question? I'm free ${humanDay(day1)} ${hhmm(w1.start)}–${hhmm(w1.end)} or ${humanDay(day2)} ${hhmm(w2.start)}–${hhmm(w2.end)} (IST). Thanks!`,
    });
    return {
      rows, storeDate,
      prompt: taskPrompt(storeDate, `Handle the open support thread from ${customer.name}.`),
      expected: {
        customer_id: customer.id, thread_id: thread.id,
        windows: [w1, w2].map((w) => ({ start: formatWallTime(w.start), end: formatWallTime(w.end) })),
        support_staff_ids: support.map((s) => s.id),
      },
    };
  },
  checks: [
    {
      id: 'valid-callback', kind: 'required', weight: 3,
      description: 'Exactly one 30-minute call with an on-duty support person, inside a window the customer offered, within business hours, not overlapping their calendar.',
      evaluate: ({ expected: e, diff, final }) => {
        const events = added(diff, 'calendar_events');
        if (events.length !== 1) return fail(`expected exactly one new event, got ${events.length}`);
        const ev = events[0];
        const start = wall(ev, 'starts_at');
        const end = wall(ev, 'ends_at');
        const problems: string[] = [];
        if (!e.support_staff_ids.includes(num(ev, 'staff_id'))) problems.push('not an on-duty support person');
        if (minutesBetween(start, end) !== POLICY_RULES.callback_minutes) problems.push('not 30 minutes');
        if (ev?.customer_id === null || num(ev, 'customer_id') !== e.customer_id) problems.push('not linked to the customer');
        if (!e.windows.some((w) => start >= w.start && end <= w.end)) problems.push("outside the customer's windows");
        const { start: open, end: close } = POLICY_RULES.business_hours;
        if (Number(start.slice(11, 13)) < open || end.slice(11) > `${String(close).padStart(2, '0')}:00`) problems.push('outside business hours');
        const clash = final.calendar_events.some(
          (o) => num(o, 'id') !== num(ev, 'id') && num(o, 'staff_id') === num(ev, 'staff_id') && wall(o, 'starts_at') < end && wall(o, 'ends_at') > start,
        );
        if (clash) problems.push('overlaps another event');
        return problems.length === 0 ? pass(`booked ${start}`) : fail(problems.join('; '));
      },
    },
    {
      id: 'reply-states-time', kind: 'required', weight: 1, description: 'The reply tells the customer the booked time.',
      evaluate: ({ expected: e, diff }) => {
        const events = added(diff, 'calendar_events');
        if (events.length !== 1) return fail('no single booked event to report');
        const time = wall(events[0], 'starts_at').slice(11);
        return agentReplies(diff, e.thread_id).some((b) => mentionsTime(b, time)) ? pass(`reply states ${time}`) : fail(`no reply states ${time}`);
      },
    },
  ],
  allowed: (e) => [allow('calendar_events', 'add'), ...replyRules(e.thread_id)],
};
