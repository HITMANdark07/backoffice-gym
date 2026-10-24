// Checks the production build: every prerendered page has a title, a description and an og:image; the page counts match.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../.next/server/app/', import.meta.url).pathname;
const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) pages.push(p);
  }
};
walk(root);

const problems = [];
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  if (rel.startsWith('_') || rel === 'not-found.html' || rel.endsWith('404.html')) continue;
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: no <title>`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) problems.push(`${rel}: no meta description`);
  if (!/<meta property="og:image"/.test(html)) problems.push(`${rel}: no og:image`);
}
const count = (prefix) => pages.filter((p) => relative(root, p).startsWith(prefix) && relative(root, p) !== `${prefix.slice(0, -1)}.html`).length;
const runs = count('runs/');
const tasks = count('tasks/');
if (runs !== 48) problems.push(`expected 48 run pages, found ${runs}`);
if (tasks !== 8) problems.push(`expected 8 task pages, found ${tasks}`);
console.log(`checked ${pages.length} pages (${runs} runs, ${tasks} tasks)`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('all pages have a title, a description and an og:image');
