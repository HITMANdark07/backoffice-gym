import Link from 'next/link';
import { site } from '@/lib/site';

const NAV = [
  { href: '/tasks', label: 'Tasks' },
  { href: '/runs', label: 'Runs' },
  { href: '/try/damaged-item', label: 'Try it' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-2xl leading-none no-underline">
          {site.name}
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-fg-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-fg">
              {n.label}
            </Link>
          ))}
          <a href={site.repo} className="hover:text-fg">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
