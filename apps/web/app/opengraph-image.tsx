import { stats } from '@/lib/content';
import { OG_SIZE, renderOgImage } from '@/lib/og';
import { site } from '@/lib/site';

export const dynamic = 'force-static';
export const alt = site.tagline;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  const s = stats();
  return renderOgImage({
    eyebrow: `${s.tasks} tasks · ${s.traps} traps · ${s.runs} recorded runs`,
    title: site.tagline,
    footer: `${site.name} · scored by SQL, not by another model`,
  });
}
