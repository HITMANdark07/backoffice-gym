import { site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-fg-meta sm:px-6">
        <p>
          {site.name} · open source (MIT) · <a href={site.repo}>source on GitHub</a>
        </p>
        <p>
          Built by <a href={site.authorUrl}>{site.author}</a>
        </p>
      </div>
    </footer>
  );
}
