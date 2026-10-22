import { z } from 'zod';

/** Postgres int4 max: ids and seeds are int4 columns. */
export const MAX_INT = 2_147_483_647;
/** Largest dollar amount a tool accepts; far above any real order. */
export const MAX_AMOUNT = 1_000_000;

export const id = () => z.number().int().positive().max(MAX_INT);
export const money = () => z.number().positive().max(MAX_AMOUNT);
/** A string Postgres can store: text and jsonb reject NUL characters. */
export const text = () => z.string().regex(/^[^\u0000]*$/, 'must not contain NUL characters');
