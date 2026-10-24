import { TASKS } from '@backoffice-gym/core';
import { runsForTask } from '@/lib/content';
import { OG_SIZE, renderOgImage } from '@/lib/og';

export const dynamic = 'force-static';
export const alt = 'A BackOffice Gym task';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return TASKS.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const task = TASKS.find((t) => t.slug === slug);
  const runs = runsForTask(slug);
  return renderOgImage({
    eyebrow: `Task · ${runs.filter((r) => r.reward === 1).length}/${runs.length} recorded runs at reward 1`,
    title: task?.title ?? 'BackOffice Gym',
    footer: task?.summary ?? 'An RL environment where AI agents run a store',
  });
}
