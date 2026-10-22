import { humanDay, isoDate } from '../util/time';

export function taskPrompt(storeDate: Date, instruction: string): string {
  return [
    'You are the operations assistant at Juniper Goods, an online home-goods store.',
    `Today is ${humanDay(storeDate)} ${storeDate.getUTCFullYear()} (${isoDate(storeDate)}, IST).`,
    instruction,
    'Read the store policy before acting and follow it. Use the tools to look things up and make changes. Call submit when you are done.',
  ].join('\n');
}
