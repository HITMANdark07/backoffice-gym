import { damagedItem } from './templates/damaged-item';
import { refundWindowTrap } from './templates/refund-window-trap';
import type { AnyTask } from './types';

/** Every task template, in display order. */
export const TASKS: AnyTask[] = [damagedItem, refundWindowTrap];

export const getTask = (slug: string): AnyTask | undefined => TASKS.find((t) => t.slug === slug);
