import { describe, expect, it, vi } from 'vitest';
import handler from '../api/og';

// @vercel/og only runs on Vercel's edge runtime, so this checks what the handler asks it to draw.
vi.mock('@vercel/og', () => ({
  ImageResponse: class {
    constructor(
      public element: unknown,
      public options: { width: number; height: number; headers?: Record<string, string> },
    ) {}
  },
}));

const call = (query: string) => {
  const res = handler(new Request(`https://x.test/api/og?${query}`)) as unknown as {
    element: unknown;
    options: { width: number; height: number; headers?: Record<string, string> };
  };
  return { ...res.options, text: JSON.stringify(res.element) };
};

describe('/api/og', () => {
  it('draws a 1200x630 card with the score', () => {
    const { width, height, text } = call('score=7');
    expect([width, height]).toEqual([1200, 630]);
    expect(text).toContain('7/10');
  });

  it('draws a 1080x1920 story as a download', () => {
    const { width, height, headers } = call('score=7&format=story');
    expect([width, height]).toEqual([1080, 1920]);
    expect(headers?.['Content-Disposition']).toContain('story-7.png');
  });

  it('clamps junk scores', () => {
    expect(call('score=abc').text).toContain('0/10');
    expect(call('score=999').text).toContain('10/10');
    expect(call('score=-4').text).toContain('0/10');
  });
});
