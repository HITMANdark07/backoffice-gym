import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AboutPage from '../about/page';
import TryPage, { dynamicParams, generateMetadata, generateStaticParams } from './[slug]/page';

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('try and about pages', () => {
  it('prerenders a try page per task with a start button and the recorded runs to beat', async () => {
    expect(generateStaticParams()).toHaveLength(8);
    expect(dynamicParams).toBe(false);
    const html = renderToString(await TryPage(params('refund-window-trap')));
    expect(html).toContain('Start an episode');
    expect(html).toMatch(/Nemotron 3 Ultra/);
    expect((await generateMetadata(params('refund-window-trap'))).title).toBe('Try it: Refund outside the window');
  });

  it('explains the method, the interfaces and the limits', () => {
    const html = renderToString(<AboutPage />);
    expect(html).toContain('from backoffice_gym import BackOfficeGym');
    expect(html).toContain('Limitations');
    expect(html).toContain('https://github.com/HITMANdark07/mcp-evals');
  });
});
