import { useEffect } from 'react';
import { pillOutline, pillWhite } from '../components/ui';
import { campaign } from '../config/campaign';
import { useSession } from '../lib/session';
import { ctaHref, ogUrl, share, toast } from '../lib/share';
import { track } from '../lib/track';

const HEADS = 10;

export function Win() {
  const { win: copy } = campaign;
  const { session, copy: reward } = useSession();
  const coupon = session?.reward;

  useEffect(() => track('result_view', { win: true }), []);

  const copyCode = async () => {
    await navigator.clipboard.writeText(coupon!.code);
    track('coupon_copy');
    toast(copy.copied);
  };

  return (
    <div className="relative flex min-h-full flex-col items-center overflow-hidden bg-[#2a1204] px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center">
      <div className="win-burst pointer-events-none absolute top-0 size-[150vw] max-w-[900px]" />
      <div className="win-boss relative mt-4 h-36 w-32 rounded-t-[3rem] bg-[#5a1a14]" />
      <main className="relative mt-6 flex w-full max-w-md flex-1 flex-col items-center gap-3">
        <h1 className="font-display text-4xl font-bold text-gold">
          {copy.defeated(campaign.bossName)}
        </h1>
        {coupon ? (
          <>
            <button
              onClick={() => void copyCode()}
              aria-label={`${copy.tapToCopy}: ${coupon.code}`}
              className="mt-2 w-full rounded-2xl border-2 border-dashed border-gold bg-black/40 p-5"
            >
              <span className="block font-mono text-3xl font-bold" data-testid="coupon">
                {coupon.code}
              </span>
              <span className="text-sm text-neutral-200">{copy.tapToCopy}</span>
            </button>
            <p className="font-semibold">
              {copy.validTill(new Date(coupon.expiresAt).toLocaleDateString())}
            </p>
            <p className="text-neutral-200">{reward.rewardConditions}</p>
          </>
        ) : (
          <p>{copy.noCoupon}</p>
        )}
      </main>
      <footer className="relative mt-6 flex w-full max-w-md flex-col gap-3">
        <a
          href={ctaHref('win')}
          onClick={() => track('cta_click', { from: 'win' })}
          className={pillWhite}
        >
          {campaign.ctaLabel}
        </a>
        <button onClick={() => void share(HEADS)} className={pillOutline}>
          {copy.shareVictory}
        </button>
        <a href={ogUrl(HEADS, 'story')} download className="min-h-11 pt-2 underline">
          {campaign.result.story}
        </a>
      </footer>
    </div>
  );
}
