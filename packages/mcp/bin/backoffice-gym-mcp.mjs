#!/usr/bin/env node
// Runs the TypeScript entry through tsx, so the server needs no build step.
import { register } from 'tsx/esm/api';

register();
const { run } = await import('../src/main.ts');
await run(process.argv.slice(2));
