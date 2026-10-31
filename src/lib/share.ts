import { campaign } from '../config/campaign';
import { track } from './track';

export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent('toast', { detail: message }));
}

/** Shares a score, or a plain invite when there is none yet. */
export async function share(score?: number): Promise<void> {
  const url = location.origin;
  const text = score === undefined ? campaign.share.invite(url) : campaign.share.score(score, url);
  track('share_click', { score });
  if (navigator.share) {
    try {
      await navigator.share({ title: campaign.share.title, text });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  await navigator.clipboard.writeText(text);
  toast(campaign.share.linkCopied);
}

export function ctaHref(source: string): string {
  const url = new URL(campaign.ctaUrl);
  url.searchParams.set('utm_source', 'mini_game');
  url.searchParams.set('utm_medium', source);
  url.searchParams.set('utm_campaign', campaign.id);
  return url.toString();
}

export const ogUrl = (score: number, format: 'card' | 'story'): string =>
  `/api/og?score=${score}&format=${format}`;
