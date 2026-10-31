import { ImageResponse } from '@vercel/og';
import type { ReactElement } from 'react';
import { campaign } from '../src/config/campaign.ts';

export const config = { runtime: 'edge' };

const SIZES = {
  card: { width: 1200, height: 630, big: 200, text: 44 },
  story: { width: 1080, height: 1920, big: 320, text: 64 },
};

// Plain element objects, which satori accepts, so this file needs no JSX setup.
const el = (type: string, style: object, ...children: unknown[]) =>
  ({ type, props: { style, children } }) as unknown as ReactElement;

export default function handler(req: Request): Response {
  const params = new URL(req.url).searchParams;
  const score = Math.min(10, Math.max(0, Math.trunc(Number(params.get('score'))) || 0));
  const format = params.get('format') === 'story' ? 'story' : 'card';
  const { width, height, big, text } = SIZES[format];

  return new ImageResponse(
    el(
      'div',
      {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #4a160c, #0b0705)',
        color: '#fff',
      },
      el('div', { fontSize: text, color: '#ffc83d' }, campaign.gameTitle),
      el('div', { fontSize: big, fontWeight: 700 }, campaign.result.outOf(score)),
      el('div', { fontSize: text }, 'Can you beat me?'),
    ),
    {
      width,
      height,
      headers:
        format === 'story'
          ? { 'Content-Disposition': `attachment; filename="story-${score}.png"` }
          : undefined,
    },
  );
}
