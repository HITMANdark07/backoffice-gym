import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

export async function renderOgImage({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  const serif = await readFile(join(process.cwd(), 'assets/fonts/InstrumentSerif-Regular.ttf'));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#fbfbf8', color: '#111214' }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 2, textTransform: 'uppercase', color: '#1d4ed8' }}>{eyebrow}</div>
        <div style={{ display: 'flex', fontFamily: 'Instrument Serif', fontSize: 72, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#52525b' }}>{footer}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: 'Instrument Serif', data: serif, style: 'normal', weight: 400 }] },
  );
}
