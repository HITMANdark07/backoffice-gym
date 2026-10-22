import { addressChange } from './templates/address-change';
import { approvalTrap } from './templates/approval-trap';
import { damagedItem } from './templates/damaged-item';
import { duplicateCharge } from './templates/duplicate-charge';
import { refundWindowTrap } from './templates/refund-window-trap';
import { restockBudget } from './templates/restock-budget';
import type { AnyTask } from './types';

/** Every task template, in display order. */
export const TASKS: AnyTask[] = [damagedItem, refundWindowTrap, restockBudget, addressChange, approvalTrap, duplicateCharge];

export const getTask = (slug: string): AnyTask | undefined => TASKS.find((t) => t.slug === slug);
