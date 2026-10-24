import { rewardLabel } from '@/lib/format';

export function RewardChip({ reward }: { reward: number }) {
  const tone = reward === 1 ? 'border-ok text-ok bg-ok-bg' : reward === 0 ? 'border-bad text-bad bg-bad-bg' : 'border-hl-edge text-fg bg-hl';
  return <span className={`inline-block rounded-full border px-2.5 py-1 font-mono text-xs ${tone}`}>reward {rewardLabel(reward)}</span>;
}
