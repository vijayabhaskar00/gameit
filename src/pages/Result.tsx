import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArcherSilhouette, BackHeader, BowEmblem, pillOutline, pillWhite } from '../components/ui';
import { campaign } from '../config/campaign';
import { api, type RoundResult } from '../lib/api';
import { useAsset } from '../lib/assets';
import { unlockAudio } from '../lib/audio';
import { useSession } from '../lib/session';
import { ctaHref, ogUrl, share } from '../lib/share';
import { track } from '../lib/track';

const COUNT_MS = 600;

function useCountUp(target: number | null): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      setValue(Math.round(target * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export function Result() {
  const { result: copy } = campaign;
  const { roundId } = useParams();
  const navigate = useNavigate();
  const state = useLocation().state as RoundResult | null;
  const { session, copy: reward } = useSession();
  const art = useAsset('results_bg');
  const [score, setScore] = useState<number | null>(state?.score ?? null);
  const shown = useCountUp(score);
  const attempts = state?.attemptsLeft ?? session?.attemptsLeft ?? 0;

  useEffect(() => {
    track('result_view', { roundId });
    if (score === null && roundId) {
      void api()
        .then((client) => client.roundScore(roundId))
        .then(setScore);
    }
  }, [roundId, score]);

  return (
    <div
      className="relative flex min-h-full flex-col overflow-hidden bg-[#3a0c0a] bg-cover bg-center"
      style={art ? { backgroundImage: `url(${art})` } : undefined}
    >
      {!art && (
        <ArcherSilhouette className="pointer-events-none absolute -right-6 bottom-20 h-96 opacity-30" />
      )}
      <BackHeader title={copy.title} />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-2 px-5 pt-2 text-center">
        <BowEmblem className="size-20" />
        <p className="text-neutral-200">{copy.yourScore}</p>
        <p className="font-display text-7xl font-bold" data-testid="score">
          {copy.outOf(shown)}
        </p>
        {score !== null && (
          <>
            <p className="text-neutral-200">{copy.left(score)}</p>
            <p className="mt-3 text-2xl font-bold">
              {score >= copy.closeFrom ? copy.close : copy.laughs(campaign.bossName)}
            </p>
            <p className="text-neutral-200">{copy.hitAll(reward.rewardShort)}</p>
          </>
        )}
        <div className="card mt-4 flex w-full items-center justify-between gap-3">
          <span className="font-semibold">{copy.attempts(attempts)}</span>
          <button
            disabled={attempts === 0}
            onClick={() => {
              unlockAudio();
              track('play_again_click');
              navigate('/play');
            }}
            className={pillWhite}
          >
            {copy.playAgain}
          </button>
        </div>
        {score !== null && (
          <a href={ogUrl(score, 'story')} download className="min-h-11 pt-3 underline">
            {copy.story}
          </a>
        )}
      </main>
      <footer className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-3 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <button onClick={() => void share(score ?? 0)} className={pillOutline}>
          {copy.share}
        </button>
        <a
          href={ctaHref('result')}
          onClick={() => track('cta_click', { from: 'result' })}
          className={pillWhite}
        >
          {campaign.ctaLabel}
        </a>
      </footer>
    </div>
  );
}
