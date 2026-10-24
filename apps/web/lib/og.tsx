import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

export async function renderOgImage({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  const display = await readFile(join(process.cwd(), 'assets/fonts/BricolageGrotesque-700.woff'));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#f7f6f1', color: '#14171a' }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', color: '#0f6b4f' }}>{eyebrow}</div>
        <div style={{ display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 68, lineHeight: 1.02, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#4b5157' }}>{footer}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Bricolage Grotesque', data: display, style: 'normal', weight: 700 }] },
  );
}
