import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';

export default function NotFound() {
  return (
    <section className="py-16">
      <h1 className="font-serif text-5xl">Not found</h1>
      <p className="mt-3 text-fg-muted">There is no page here. The run or task may have a different id.</p>
      <p className="mt-6">
        <Link href="/runs" className="inline-flex items-center gap-1.5">
          All recorded runs <ArrowRightIcon className="size-3.5" />
        </Link>
      </p>
    </section>
  );
}
