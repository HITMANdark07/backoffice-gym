import type { AnyTask } from './types';

/** Every task template, in display order. Templates are added in Tasks 9–12. */
export const TASKS: AnyTask[] = [];

export const getTask = (slug: string): AnyTask | undefined => TASKS.find((t) => t.slug === slug);
