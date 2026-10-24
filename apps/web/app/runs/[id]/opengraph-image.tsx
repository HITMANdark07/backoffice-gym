import { getReplay, listRuns, taskTitle } from '@/lib/content';
import { rewardLabel } from '@/lib/format';
import { modelLabel } from '@/lib/models';
import { OG_SIZE, renderOgImage } from '@/lib/og';

export const dynamic = 'force-static';
export const alt = 'A recorded BackOffice Gym run';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return listRuns().map((r) => ({ id: r.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const replay = getReplay((await params).id);
  return renderOgImage({
    eyebrow: replay ? `Recorded run · reward ${rewardLabel(replay.score.reward)}` : 'Recorded run',
    title: replay ? `${modelLabel(replay.run.model)} on “${taskTitle(replay.run.task)}”` : 'BackOffice Gym',
    footer: 'BackOffice Gym · an RL environment where AI agents run a store',
  });
}
